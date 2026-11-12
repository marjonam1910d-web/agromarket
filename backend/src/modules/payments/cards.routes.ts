import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { ah, ok, created, validate } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { audit } from '../../common/audit';
import { afterPaid, markPaid } from './payments.service';

/**
 * Saqlangan kartalar (Uzcard / Humo).
 *
 * XAVFSIZLIK: karta raqami va amal qilish muddati bizning serverda HECH QACHON saqlanmaydi.
 *  - Real rejim (Payme Subscribe API): karta raqami brauzerdan to'g'ridan-to'g'ri Payme'ga yuboriladi
 *    (cards.create → SMS kod → cards.verify). Bizga faqat Payme bergan TOKEN keladi; uni cards.check orqali
 *    tekshirib, niqoblangan raqam bilan saqlaymiz. To'lov: receipts.create + receipts.pay(token).
 *  - Sandbox (demo/development): test kartalar bilan butun jarayon simulyatsiya qilinadi, SMS kod: 666666.
 */
const r = Router();
r.use(authenticate);

const SANDBOX_SMS_CODE = '666666';
const brandOf = (pan: string) => (/^(8600|5614|6262)/.test(pan) ? 'UZCARD' : /^9860/.test(pan) ? 'HUMO' : null);
const mask = (pan: string) => `${pan.slice(0, 4)} ${pan.slice(4, 6)}** **** ${pan.slice(-4)}`;

const view = (c: { id: string; maskedPan: string; expire: string; brand: string; label: string | null; isDefault: boolean; provider: string; createdAt: Date }) => ({
  id: c.id,
  maskedPan: c.maskedPan,
  expire: c.expire,
  brand: c.brand,
  label: c.label,
  isDefault: c.isDefault,
  sandbox: c.provider === 'sandbox',
  createdAt: c.createdAt,
});

async function saveCard(userId: string, data: { provider: 'payme' | 'sandbox'; token: string; maskedPan: string; expire: string; brand: string; label?: string }) {
  const count = await prisma.paymentCard.count({ where: { userId } });
  if (count >= 10) throw Errors.badRequest("Ko'pi bilan 10 ta karta saqlash mumkin");
  return prisma.paymentCard.create({ data: { userId, ...data, isDefault: count === 0 } });
}

// ───────── Payme Subscribe API (server tomoni: faqat token bilan ishlaydi) ─────────
async function paymeSubscribe<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const base = env.PAYME_TEST_MODE ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';
  const r2 = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth': `${env.PAYME_MERCHANT_ID}:${env.PAYME_KEY}` },
    body: JSON.stringify({ id: Date.now(), method, params }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r2.json()) as { result?: T; error?: { message?: string | Record<string, string> } };
  if (j.error) {
    const m = typeof j.error.message === 'string' ? j.error.message : (j.error.message?.uz ?? j.error.message?.ru ?? 'Payme xatosi');
    throw new AppError(400, 'CARD_PROVIDER_ERROR', m);
  }
  return j.result as T;
}

r.get(
  '/',
  ah(async (req, res) => {
    const list = await prisma.paymentCard.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
    ok(res, list.map(view));
  }),
);

/** Karta qo'shish imkoniyatlari (frontend qaysi oqimni ko'rsatishini biladi) */
r.get(
  '/options',
  ah(async (_req, res) => {
    ok(res, {
      mode: env.paymeEnabled ? 'payme' : env.sandboxAllowed ? 'sandbox' : 'disabled',
      paymeMerchantId: env.paymeEnabled ? env.PAYME_MERCHANT_ID : null, // ommaviy identifikator (kalit emas)
      paymeTest: env.PAYME_TEST_MODE,
      sandboxSmsCode: env.paymeEnabled ? null : env.sandboxAllowed ? SANDBOX_SMS_CODE : null,
    });
  }),
);

// ───────── Sandbox: 1-qadam — karta ma'lumotlari, SMS yuborildi deb hisoblanadi ─────────
r.post(
  '/sandbox/start',
  authLimiter(),
  validate({ body: z.object({ number: z.string().regex(/^\d{16}$/, "Karta raqami 16 ta raqam"), expire: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Muddat MM/YY') }) }),
  ah(async (req, res) => {
    if (env.paymeEnabled || !env.sandboxAllowed) throw Errors.notFound('Sahifa');
    const brand = brandOf(req.body.number);
    if (!brand) throw Errors.badRequest('Faqat Uzcard (8600, 5614, 6262) va Humo (9860) kartalari qabul qilinadi');
    const [mm, yy] = req.body.expire.split('/').map(Number);
    if (new Date(2000 + yy, mm, 1) < new Date()) throw Errors.badRequest('Kartaning amal qilish muddati tugagan');
    // Karta raqami saqlanmaydi: faqat niqoblangan ko'rinish imzolangan vaqtinchalik tokenga yoziladi
    const pending = jwt.sign({ u: req.user!.id, m: mask(req.body.number), e: req.body.expire, b: brand }, env.JWT_ACCESS_SECRET, { expiresIn: '5m', audience: 'card-sandbox' });
    ok(res, { pending, phoneMask: '+998 ** *** ** 67', smsCode: SANDBOX_SMS_CODE });
  }),
);

// ───────── Sandbox: 2-qadam — SMS kod bilan tasdiqlash ─────────
r.post(
  '/sandbox/verify',
  authLimiter(),
  validate({ body: z.object({ pending: z.string(), code: z.string().regex(/^\d{6}$/), label: z.string().max(40).optional() }) }),
  ah(async (req, res) => {
    if (env.paymeEnabled || !env.sandboxAllowed) throw Errors.notFound('Sahifa');
    let p: { u: string; m: string; e: string; b: string };
    try {
      p = jwt.verify(req.body.pending, env.JWT_ACCESS_SECRET, { audience: 'card-sandbox' }) as typeof p;
    } catch {
      throw new AppError(400, 'CARD_PENDING_EXPIRED', "Vaqt tugadi. Kartani qaytadan kiriting");
    }
    if (p.u !== req.user!.id) throw Errors.forbidden();
    if (req.body.code !== SANDBOX_SMS_CODE) throw new AppError(400, 'OTP_INVALID', "SMS kod noto'g'ri");
    const card = await saveCard(req.user!.id, { provider: 'sandbox', token: `sbx_card_${crypto.randomBytes(12).toString('hex')}`, maskedPan: p.m, expire: p.e, brand: p.b, label: req.body.label });
    await audit(req, 'card.add', 'PaymentCard', card.id, { sandbox: true });
    created(res, view(card));
  }),
);

// ───────── Real: Payme token (brauzer cards.verify'dan keyin oladi) ─────────
r.post(
  '/payme',
  authLimiter(),
  validate({ body: z.object({ token: z.string().min(10).max(2000), label: z.string().max(40).optional() }) }),
  ah(async (req, res) => {
    if (!env.paymeEnabled) throw Errors.notFound('Sahifa');
    const chk = await paymeSubscribe<{ card: { number: string; expire: string; token: string; verify: boolean } }>('cards.check', { token: req.body.token });
    if (!chk.card?.verify) throw new AppError(400, 'CARD_NOT_VERIFIED', 'Karta SMS orqali tasdiqlanmagan');
    const digits = chk.card.number.replace(/\D/g, '');
    const card = await saveCard(req.user!.id, {
      provider: 'payme',
      token: chk.card.token,
      maskedPan: chk.card.number,
      expire: chk.card.expire,
      brand: brandOf(digits.padEnd(16, '0')) ?? 'UZCARD',
      label: req.body.label,
    });
    await audit(req, 'card.add', 'PaymentCard', card.id);
    created(res, view(card));
  }),
);

r.patch(
  '/:id/default',
  ah(async (req, res) => {
    const c = await prisma.paymentCard.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!c) throw Errors.notFound('Karta');
    await prisma.$transaction([
      prisma.paymentCard.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } }),
      prisma.paymentCard.update({ where: { id: c.id }, data: { isDefault: true } }),
    ]);
    ok(res, { ok: true });
  }),
);

r.delete(
  '/:id',
  ah(async (req, res) => {
    const c = await prisma.paymentCard.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!c) throw Errors.notFound('Karta');
    if (c.provider === 'payme' && env.paymeEnabled) await paymeSubscribe('cards.remove', { token: c.token }).catch(() => undefined);
    await prisma.paymentCard.delete({ where: { id: c.id } });
    if (c.isDefault) {
      const next = await prisma.paymentCard.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } });
      if (next) await prisma.paymentCard.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    await audit(req, 'card.remove', 'PaymentCard', c.id);
    ok(res, { ok: true });
  }),
);

/** Saqlangan karta bilan bir bosishda to'lash */
r.post(
  '/pay',
  authLimiter(),
  validate({ body: z.object({ orderId: z.string(), cardId: z.string() }) }),
  ah(async (req, res) => {
    const [order, card] = await Promise.all([
      prisma.order.findFirst({ where: { id: req.body.orderId, buyerId: req.user!.id }, include: { payments: true } }),
      prisma.paymentCard.findFirst({ where: { id: req.body.cardId, userId: req.user!.id } }),
    ]);
    if (!order) throw Errors.notFound('Buyurtma');
    if (!card) throw Errors.notFound('Karta');
    if (order.status === 'cancelled' || order.paymentStatus === 'paid') throw new AppError(409, 'NOT_PAYABLE', "Bu buyurtmani to'lab bo'lmaydi");
    if (order.payments.some((p) => p.status === 'processing')) throw new AppError(409, 'PAYMENT_IN_PROGRESS', "To'lov jarayonda");

    if (card.provider === 'sandbox') {
      if (!env.sandboxAllowed) throw new AppError(503, 'PAYMENT_UNAVAILABLE', "Sinov kartasi bilan to'lab bo'lmaydi");
      const payment = await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({ where: { orderId: order.id, status: 'pending' }, data: { status: 'cancelled', failureReason: 'replaced' } });
        await tx.order.update({ where: { id: order.id }, data: { paymentMethod: 'card' } });
        const p = await tx.payment.create({ data: { orderId: order.id, provider: 'sandbox', method: 'card', amount: order.total } });
        await tx.paymentTransaction.create({
          data: { paymentId: p.id, provider: 'sandbox', providerTxId: `sbx_${crypto.randomBytes(8).toString('hex')}`, state: 2, amount: p.amount, createTime: BigInt(Date.now()), performTime: BigInt(Date.now()), rawPayload: { simulated: true, card: card.maskedPan } },
        });
        await markPaid(tx, p.id);
        return p;
      });
      void afterPaid(payment.id);
      return ok(res, { paymentId: payment.id, status: 'paid' });
    }

    // Real: Payme chek yaratiladi va token bilan to'lanadi. Natija Payme Merchant API webhook'i orqali markPaid'ga keladi.
    const payment = await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'pending' }, data: { status: 'cancelled', failureReason: 'replaced' } });
      await tx.order.update({ where: { id: order.id }, data: { paymentMethod: 'card' } });
      return tx.payment.create({ data: { orderId: order.id, provider: 'payme', method: 'card', amount: order.total } });
    });
    const receipt = await paymeSubscribe<{ receipt: { _id: string } }>('receipts.create', { amount: Number(payment.amount.mul(100).toFixed(0)), account: { order_id: payment.id } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: receipt.receipt._id } });
    const paid = await paymeSubscribe<{ receipt: { state: number } }>('receipts.pay', { id: receipt.receipt._id, token: card.token });
    ok(res, { paymentId: payment.id, status: paid.receipt.state === 4 ? 'paid' : 'processing' });
  }),
);

export default r;
