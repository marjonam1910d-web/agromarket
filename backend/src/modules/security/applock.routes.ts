import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ah, ok, created, validate } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { audit } from '../../common/audit';
import { destroySession, revokeAllSessions } from '../auth/auth.service';
import { b64u, checkClientData, parseClientData, rp, verifyAssertion } from './webauthn';

/**
 * Ilova qulfi (bank ilovalari kabi).
 * - Ilova o'rnatilgandan keyin PIN o'rnatish majburiy (frontend talab qiladi), barmoq izi ixtiyoriy.
 * - Ilova fonga o'tsa/qayta ochilsa — PIN yoki barmoq izi so'raladi.
 * - PIN 5 marta xato kiritilsa: qurilma qulfi o'chiriladi va BARCHA sessiyalar yopiladi → parol bilan qayta kirish.
 */
const r = Router();
const MAX_PIN_ATTEMPTS = 5;
const CHALLENGE_TTL_MS = 2 * 60_000;
const pinSchema = z.string().regex(/^\d{4}$/, "PIN 4 ta raqamdan iborat bo'lsin");
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '1212']);

async function ownDevice(id: string, userId: string) {
  const d = await prisma.appDevice.findUnique({ where: { id } });
  if (!d || d.userId !== userId) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Qurilma topilmadi. Qulfni qayta sozlang');
  return d;
}

const deviceView = (d: { id: string; credentialId: string | null; createdAt: Date; lastUnlockAt: Date | null; name: string | null }) => ({
  deviceId: d.id,
  name: d.name,
  biometric: Boolean(d.credentialId),
  createdAt: d.createdAt,
  lastUnlockAt: d.lastUnlockAt,
});

r.use(authenticate);

/** Foydalanuvchining qulf o'rnatilgan qurilmalari */
r.get(
  '/devices',
  ah(async (req, res) => {
    const list = await prisma.appDevice.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
    ok(res, list.map(deviceView));
  }),
);

r.get(
  '/app-lock/:deviceId',
  ah(async (req, res) => {
    const d = await prisma.appDevice.findUnique({ where: { id: req.params.deviceId } });
    ok(res, d && d.userId === req.user!.id ? { exists: true, ...deviceView(d) } : { exists: false });
  }),
);

/** PIN o'rnatish (yangi qurilma) */
r.post(
  '/app-lock',
  authLimiter(),
  validate({ body: z.object({ pin: pinSchema, name: z.string().max(80).optional() }) }),
  ah(async (req, res) => {
    if (WEAK_PINS.has(req.body.pin)) throw Errors.badRequest("Juda oddiy PIN. Boshqa raqamlar tanlang");
    const d = await prisma.appDevice.create({
      data: { userId: req.user!.id, pinHash: await bcrypt.hash(req.body.pin, 10), name: req.body.name ?? req.get('user-agent')?.slice(0, 80) ?? null },
    });
    await audit(req, 'applock.setup', 'AppDevice', d.id);
    created(res, deviceView(d));
  }),
);

/** PIN'ni o'zgartirish (joriy PIN talab qilinadi) */
r.put(
  '/app-lock/:deviceId/pin',
  authLimiter(),
  validate({ body: z.object({ currentPin: pinSchema, pin: pinSchema }) }),
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    if (!(await bcrypt.compare(req.body.currentPin, d.pinHash))) throw new AppError(400, 'PIN_INVALID', "Joriy PIN noto'g'ri");
    if (WEAK_PINS.has(req.body.pin)) throw Errors.badRequest("Juda oddiy PIN. Boshqa raqamlar tanlang");
    await prisma.appDevice.update({ where: { id: d.id }, data: { pinHash: await bcrypt.hash(req.body.pin, 10), failedAttempts: 0 } });
    await audit(req, 'applock.pin_change', 'AppDevice', d.id);
    ok(res, { ok: true });
  }),
);

/** PIN bilan qulfni ochish */
r.post(
  '/app-lock/:deviceId/verify',
  authLimiter(),
  validate({ body: z.object({ pin: pinSchema }) }),
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    if (await bcrypt.compare(req.body.pin, d.pinHash)) {
      await prisma.appDevice.update({ where: { id: d.id }, data: { failedAttempts: 0, lastUnlockAt: new Date() } });
      return ok(res, { ok: true });
    }
    const attempts = d.failedAttempts + 1;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await prisma.appDevice.delete({ where: { id: d.id } });
      await revokeAllSessions(req.user!.id);
      await destroySession(req, res);
      await audit(req, 'applock.reset_too_many', 'AppDevice', d.id);
      throw new AppError(401, 'APP_LOCK_RESET', "PIN ko'p marta noto'g'ri kiritildi. Xavfsizlik uchun tizimdan chiqildi — parol bilan qayta kiring");
    }
    await prisma.appDevice.update({ where: { id: d.id }, data: { failedAttempts: attempts } });
    throw new AppError(400, 'PIN_INVALID', "PIN noto'g'ri", { attemptsLeft: MAX_PIN_ATTEMPTS - attempts });
  }),
);

/** Biometrik uchun challenge (ro'yxatdan o'tkazish yoki kirish) */
r.post(
  '/app-lock/:deviceId/biometric/challenge',
  validate({ body: z.object({ purpose: z.enum(['create', 'get']) }) }),
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    if (req.body.purpose === 'get' && !d.credentialId) throw new AppError(400, 'NO_BIOMETRIC', "Barmoq izi o'rnatilmagan");
    const challenge = b64u.enc(crypto.randomBytes(32));
    await prisma.appDevice.update({ where: { id: d.id }, data: { pendingChallenge: `${req.body.purpose}:${challenge}`, challengeAt: new Date() } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { fullName: true, phone: true, email: true } });
    ok(res, {
      challenge,
      rpId: rp().id,
      rpName: rp().name,
      userId: b64u.enc(Buffer.from(req.user!.id)),
      userName: user.phone ?? user.email ?? user.fullName,
      displayName: user.fullName,
      credentialId: d.credentialId,
      timeout: CHALLENGE_TTL_MS,
    });
  }),
);

async function takeChallenge(d: { id: string; pendingChallenge: string | null; challengeAt: Date | null }, purpose: 'create' | 'get') {
  // bir martalik: ishlatilishidan oldin o'chiriladi (replay himoyasi)
  await prisma.appDevice.update({ where: { id: d.id }, data: { pendingChallenge: null, challengeAt: null } });
  if (!d.pendingChallenge || !d.challengeAt || Date.now() - d.challengeAt.getTime() > CHALLENGE_TTL_MS) throw new AppError(400, 'CHALLENGE_EXPIRED', "Vaqt tugadi. Qayta urinib ko'ring");
  const [p, c] = d.pendingChallenge.split(':');
  if (p !== purpose) throw new AppError(400, 'CHALLENGE_EXPIRED', "Vaqt tugadi. Qayta urinib ko'ring");
  return c;
}

/** Barmoq izini ro'yxatdan o'tkazish (joriy PIN bilan tasdiqlangan holda) */
r.post(
  '/app-lock/:deviceId/biometric/register',
  authLimiter(),
  validate({
    body: z.object({
      pin: pinSchema,
      credentialId: z.string().min(16).max(1024),
      publicKey: z.string().min(40).max(2048),
      alg: z.number().int(),
      clientDataJSON: z.string().max(4096),
    }),
  }),
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    if (!(await bcrypt.compare(req.body.pin, d.pinHash))) throw new AppError(400, 'PIN_INVALID', "PIN noto'g'ri");
    const challenge = await takeChallenge(d, 'create');
    try {
      checkClientData(parseClientData(req.body.clientDataJSON).data, 'webauthn.create', challenge);
      crypto.createPublicKey({ key: b64u.dec(req.body.publicKey), format: 'der', type: 'spki' });
      if (![-7, -257].includes(req.body.alg)) throw new Error('algoritm');
    } catch (e) {
      throw new AppError(400, 'BIOMETRIC_INVALID', `Barmoq izini saqlab bo'lmadi: ${(e as Error).message}`);
    }
    await prisma.appDevice.update({
      where: { id: d.id },
      data: { credentialId: req.body.credentialId, publicKey: req.body.publicKey, publicKeyAlg: req.body.alg, signCount: 0 },
    });
    await audit(req, 'applock.biometric_on', 'AppDevice', d.id);
    ok(res, { ok: true });
  }),
);

/** Barmoq izi bilan qulfni ochish */
r.post(
  '/app-lock/:deviceId/biometric/verify',
  authLimiter(),
  validate({
    body: z.object({
      credentialId: z.string().max(1024),
      clientDataJSON: z.string().max(4096),
      authenticatorData: z.string().max(4096),
      signature: z.string().max(2048),
    }),
  }),
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    if (!d.credentialId || !d.publicKey || d.publicKeyAlg == null || d.credentialId !== req.body.credentialId) throw new AppError(400, 'NO_BIOMETRIC', "Barmoq izi o'rnatilmagan");
    const challenge = await takeChallenge(d, 'get');
    let signCount = 0;
    try {
      const cd = parseClientData(req.body.clientDataJSON);
      checkClientData(cd.data, 'webauthn.get', challenge);
      signCount = verifyAssertion({ publicKey: d.publicKey, alg: d.publicKeyAlg, authenticatorData: req.body.authenticatorData, clientDataRaw: cd.raw, signature: req.body.signature }).signCount;
    } catch (e) {
      throw new AppError(400, 'BIOMETRIC_INVALID', `Barmoq izi tasdiqlanmadi: ${(e as Error).message}`);
    }
    // Hisoblagich kamaysa — kalit nusxalangan bo'lishi mumkin
    if (signCount > 0 && signCount <= d.signCount) throw new AppError(400, 'BIOMETRIC_INVALID', 'Xavfsizlik tekshiruvi o\'tmadi. PIN bilan kiring');
    await prisma.appDevice.update({ where: { id: d.id }, data: { signCount, failedAttempts: 0, lastUnlockAt: new Date() } });
    ok(res, { ok: true });
  }),
);

r.delete(
  '/app-lock/:deviceId/biometric',
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    await prisma.appDevice.update({ where: { id: d.id }, data: { credentialId: null, publicKey: null, publicKeyAlg: null, signCount: 0 } });
    await audit(req, 'applock.biometric_off', 'AppDevice', d.id);
    ok(res, { ok: true });
  }),
);

/** Qurilmani ro'yxatdan chiqarish (masalan yo'qolgan telefon) */
r.delete(
  '/devices/:deviceId',
  ah(async (req, res) => {
    const d = await ownDevice(req.params.deviceId, req.user!.id);
    await prisma.appDevice.delete({ where: { id: d.id } });
    await audit(req, 'applock.device_removed', 'AppDevice', d.id);
    ok(res, { ok: true });
  }),
);

export default r;
