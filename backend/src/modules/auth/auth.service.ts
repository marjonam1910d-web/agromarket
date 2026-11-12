import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import type { OtpPurpose, User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AppError, Errors } from '../../common/errors';
import { EMAIL_RE, normalizePhone, randomToken, sha256 } from '../../common/utils';
import { ACCESS_COOKIE, REFRESH_COOKIE, signAccessToken } from '../../middleware/auth';
import { sendEmail, sendSms } from '../notifications/channels';

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;

export const BCRYPT_ROUNDS = env.isTest ? 4 : 12;

/** Telefon yoki email — normallashtirilgan ko'rinish */
export function parseIdentifier(raw: string): { kind: 'phone' | 'email'; value: string } {
  const v = raw.trim();
  if (v.includes('@')) {
    const email = v.toLowerCase();
    if (!EMAIL_RE.test(email)) throw Errors.badRequest("Email noto'g'ri");
    return { kind: 'email', value: email };
  }
  const phone = normalizePhone(v);
  if (!phone) throw Errors.badRequest("Telefon raqam noto'g'ri. Namuna: +998 90 123 45 67");
  return { kind: 'phone', value: phone };
}

const hashOtp = (target: string, purpose: string, code: string) =>
  crypto.createHmac('sha256', env.OTP_SECRET).update(`${target}|${purpose}|${code}`).digest('hex');

export async function requestOtp(rawTarget: string, purpose: OtpPurpose) {
  const { kind, value: target } = parseIdentifier(rawTarget);
  const existing = await prisma.user.findFirst({ where: kind === 'phone' ? { phone: target } : { email: target } });

  if (purpose === 'REGISTER' && existing) {
    throw Errors.conflict('ALREADY_REGISTERED', "Bu raqam/email bilan allaqachon ro'yxatdan o'tilgan");
  }

  const last = await prisma.otpCode.findFirst({ where: { target, purpose }, orderBy: { createdAt: 'desc' } });
  if (last && Date.now() - last.createdAt.getTime() < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new AppError(429, 'OTP_COOLDOWN', `Kodni qayta yuborish uchun ${wait} soniya kuting`, { wait });
  }

  // Parolni tiklashda foydalanuvchi mavjudligini oshkor qilmaymiz (enumeration himoyasi)
  if (purpose === 'RESET_PASSWORD' && !existing) {
    return { target, sent: true, resendIn: OTP_RESEND_MS / 1000 };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.otpCode.create({
    data: { target, purpose, codeHash: hashOtp(target, purpose, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  const otp = await prisma.otpCode.findFirst({ where: { target, purpose }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  const text = `AgroMarket tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;
  const result =
    kind === 'phone'
      ? await sendSms(target, text)
      : await sendEmail(target, `AgroMarket: ${code} — tasdiqlash kodi`, otpEmailText(code), otpEmailHtml(code));

  if (!result.delivered && !env.otpDevEcho) {
    // Yetkazilmagan kod bilan foydalanuvchini kuttirib qo'ymaymiz: yozuvni o'chirib, darhol qayta urinishga ruxsat
    if (otp) await prisma.otpCode.delete({ where: { id: otp.id } }).catch(() => undefined);
    throw new AppError(503, 'OTP_SEND_FAILED', "Kodni yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring");
  }

  // Demo/development: kod faqat haqiqatda yetkazilmaganda ekranda ko'rsatiladi
  return { target, sent: true, resendIn: OTP_RESEND_MS / 1000, ...(env.otpDevEcho && !result.delivered ? { devCode: code } : {}) };
}

function otpEmailText(code: string) {
  const min = OTP_TTL_MS / 60000;
  return [
    `AgroMarket tasdiqlash kodi: ${code}`,
    `Kod ${min} daqiqa amal qiladi. Uni hech kimga bermang.`,
    '',
    `Код подтверждения: ${code} (действует ${min} мин.)`,
    `Verification code: ${code} (valid for ${min} min)`,
    '',
    "Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.",
  ].join('\n');
}

function otpEmailHtml(code: string) {
  const min = OTP_TTL_MS / 60000;
  return `<!doctype html><html><body style="margin:0;background:#F6F3EA;font-family:Segoe UI,Arial,sans-serif;color:#1C2A22">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E8E1CF">
<tr><td style="background:#1F4D36;padding:18px 24px;color:#D8F07A;font-size:20px;font-weight:800">🌱 AgroMarket</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 8px;font-size:16px;font-weight:700">Tasdiqlash kodi</p>
<p style="margin:0 0 16px;font-size:14px;color:#5A6B60">Kodni saytdagi maydonga kiriting. U ${min} daqiqa amal qiladi.</p>
<div style="font-size:34px;letter-spacing:10px;font-weight:800;background:#F1F7E4;border-radius:12px;padding:14px 0;text-align:center;color:#1F4D36">${code}</div>
<p style="margin:16px 0 0;font-size:13px;color:#5A6B60">Код подтверждения · Verification code</p>
<p style="margin:16px 0 0;font-size:12px;color:#8A968E">Kodni hech kimga, hatto AgroMarket xodimiga ham bermang. Agar siz so'ramagan bo'lsangiz, xatni e'tiborsiz qoldiring.</p>
</td></tr></table></td></tr></table></body></html>`;
}

/** Kodni tekshiradi va 15 daqiqalik bir martalik otpToken qaytaradi */
export async function verifyOtp(rawTarget: string, purpose: OtpPurpose, code: string) {
  const { value: target } = parseIdentifier(rawTarget);
  const otp = await prisma.otpCode.findFirst({
    where: { target, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp || otp.expiresAt < new Date()) throw new AppError(400, 'OTP_EXPIRED', "Kod muddati tugagan. Yangi kod so'rang");
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new AppError(429, 'OTP_LOCKED', "Urinishlar soni tugadi. Yangi kod so'rang");

  const valid = crypto.timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hashOtp(target, purpose, code)));
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AppError(400, 'OTP_INVALID', "Kod noto'g'ri");
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  const otpToken = jwt.sign({ t: target, p: purpose, j: otp.id }, env.OTP_SECRET, { expiresIn: '15m' });
  return { otpToken, target };
}

export function readOtpToken(token: string, purpose: OtpPurpose): string {
  try {
    const p = jwt.verify(token, env.OTP_SECRET) as { t: string; p: OtpPurpose };
    if (p.p !== purpose) throw new Error();
    return p.t;
  } catch {
    throw new AppError(400, 'OTP_TOKEN_INVALID', 'Tasdiqlash muddati tugagan. Qaytadan tasdiqlang');
  }
}

export async function hashPassword(p: string) {
  return bcrypt.hash(p, BCRYPT_ROUNDS);
}

// ───────── Login ─────────
const DUMMY_HASH = bcrypt.hashSync('timing-attack-dummy', 4);

export async function login(identifier: string, password: string) {
  const { kind, value } = parseIdentifier(identifier);
  const user = await prisma.user.findFirst({ where: kind === 'phone' ? { phone: value } : { email: value } });
  const generic = new AppError(401, 'INVALID_CREDENTIALS', "Login yoki parol noto'g'ri");

  if (!user || user.deletedAt) {
    await bcrypt.compare(password, DUMMY_HASH); // vaqt bo'yicha farqni yashirish
    throw generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(423, 'ACCOUNT_LOCKED', `Ko'p noto'g'ri urinish. ${min} daqiqadan so'ng qayta urinib ko'ring`);
  }
  const okPass = await bcrypt.compare(password, user.passwordHash);
  if (!okPass) {
    const fails = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: fails >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } : { failedLoginCount: fails },
    });
    throw generic;
  }
  if (user.status === 'BLOCKED') throw new AppError(403, 'ACCOUNT_BLOCKED', 'Hisobingiz bloklangan. Qo\'llab-quvvatlash xizmatiga murojaat qiling');
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return user;
}

// ───────── Sessiyalar (refresh token rotation) ─────────
const cookieBase = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN || undefined,
});

export async function issueSession(req: Request, res: Response, user: Pick<User, 'id' | 'role'>, remember: boolean) {
  const seller = await prisma.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  const access = signAccessToken({ id: user.id, role: user.role, sellerId: seller?.id ?? null });
  const refresh = randomToken(48);
  const ttl = remember ? 30 * 24 * 3600_000 : 24 * 3600_000;
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refresh),
      userAgent: req.get('user-agent')?.slice(0, 250),
      ip: req.ip,
      expiresAt: new Date(Date.now() + ttl),
    },
  });
  res.cookie(ACCESS_COOKIE, access, { ...cookieBase(), path: '/', maxAge: 15 * 60_000 });
  res.cookie(REFRESH_COOKIE, `${refresh}.${remember ? 1 : 0}`, {
    ...cookieBase(),
    path: '/api/v1/auth',
    ...(remember ? { maxAge: ttl } : {}),
  });
  return { accessToken: access };
}

export async function rotateSession(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!raw) throw Errors.unauthorized('Sessiya topilmadi');
  const [token, rememberFlag] = raw.split('.');
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token ?? '') }, include: { user: true } });
  if (!session) throw Errors.unauthorized('Sessiya topilmadi');
  if (session.revokedAt) {
    // Qayta ishlatilgan (o'g'irlangan bo'lishi mumkin) token — barcha sessiyalarni bekor qilamiz
    await prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw Errors.unauthorized('Sessiya bekor qilingan. Qayta kiring');
  }
  if (session.expiresAt < new Date() || session.user.status !== 'ACTIVE' || session.user.deletedAt) {
    throw Errors.unauthorized('Sessiya muddati tugagan');
  }
  await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return issueSession(req, res, session.user, rememberFlag === '1');
}

export async function destroySession(req: Request, res: Response) {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (raw) {
    const [token] = raw.split('.');
    await prisma.session.updateMany({ where: { tokenHash: sha256(token ?? ''), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(ACCESS_COOKIE, { ...cookieBase(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieBase(), path: '/api/v1/auth' });
}

export async function revokeAllSessions(userId: string, opts: { keepCurrentToken?: boolean } = {}) {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!opts.keepCurrentToken) await prisma.user.update({ where: { id: userId }, data: { tokensValidAfter: new Date() } });
}

export async function publicUser(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      locale: true,
      avatarUrl: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      buyerProfile: { select: { isWholesale: true, companyName: true } },
      sellerProfile: {
        select: {
          id: true,
          farmName: true,
          slug: true,
          region: true,
          district: true,
          address: true,
          tin: true,
          logoUrl: true,
          verificationStatus: true,
          ratingAvg: true,
          ratingCount: true,
        },
      },
    },
  });
  return u;
}
