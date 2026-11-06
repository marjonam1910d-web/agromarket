import crypto from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import { ah, ok, validate } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { checkoutUrl, providerStatus, resolveProvider } from './providers';
import { afterPaid, markFailed, markPaid } from './payments.service';
import { paymeWebhook } from './payme';
import { clickComplete, clickPrepare } from './click';

const r = Router();

// ───────── Provayder webhooklari (CSRF'dan ozod, imzo/autentifikatsiya bilan himoyalangan) ─────────
r.post('/payme', paymeWebhook);
r.post('/click/prepare', express.urlencoded({ extended: false }), clickPrepare);
r.post('/click/complete', express.urlencoded({ extended: false }), clickComplete);

r.get('/providers', (_req, res) => ok(res, providerStatus()));

async function ownPayment(paymentId: string, userId: string, role: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!p || (p.order.buyerId !== userId && role !== 'ADMIN')) throw Errors.notFound("To'lov");
  return p;
}

/** To'lov holati (xaridor provayderdan qaytgach so'raydi) */
r.get(
  '/:id',
  authenticate,
  ah(async (req, res) => {
    const p = await ownPayment(req.params.id, req.user!.id, req.user!.role);
    ok(res, {
      id: p.id,
      status: p.status,
      provider: p.provider,
      method: p.method,
      amount: p.amount,
      paidAt: p.paidAt,
      failureReason: p.failureReason,
      orderId: p.orderId,
      orderNumber: p.order.orderNumber,
      sandbox: p.provider === 'sandbox',
      checkoutUrl: ['pending', 'processing'].includes(p.status) ? checkoutUrl(p) : null,
    });
  }),
);

/**
 * To'lovni boshlash / qayta urinish. Buyurtma hali to'lanmagan va bekor qilinmagan bo'lishi kerak.
 * Usulni o'zgartirish mumkin (masalan Click → Payme yoki naqd).
 */
r.post(
  '/initiate',
  authenticate,
  validate({ body: z.object({ orderId: z.string(), method: z.enum(['cash', 'payme', 'click', 'card']).optional() }) }),
  ah(async (req, res) => {
    const order = await prisma.order.findFirst({ where: { id: req.body.orderId, buyerId: req.user!.id }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
    if (!order) throw Errors.notFound('Buyurtma');
    if (order.status === 'cancelled' || order.paymentStatus === 'paid') throw new AppError(409, 'NOT_PAYABLE', "Bu buyurtmani to'lab bo'lmaydi");
    const method = req.body.method ?? order.paymentMethod;
    const provider = resolveProvider(method);
    const reusable = order.payments.find((p) => p.status === 'pending' && p.provider === provider && p.method === method);
    const payment = await prisma.$transaction(async (tx) => {
      if (reusable) return reusable;
      // eski ochiq urinishlar bekor qilinadi (bitta buyurtma — bitta faol to'lov)
      for (const p of order.payments.filter((x) => x.status === 'pending')) await markFailed(tx, p.id, 'replaced', 'cancelled');
      if (order.payments.some((x) => x.status === 'processing')) throw new AppError(409, 'PAYMENT_IN_PROGRESS', "To'lov jarayonda. Bir necha daqiqadan so'ng tekshiring");
      await tx.order.update({ where: { id: order.id }, data: { paymentMethod: method } });
      return tx.payment.create({ data: { orderId: order.id, provider, method, amount: order.total } });
    });
    ok(res, { id: payment.id, provider: payment.provider, sandbox: payment.provider === 'sandbox', checkoutUrl: checkoutUrl(payment) });
  }),
);

/**
 * SANDBOX provayder: test to'lov sahifasi shu endpointni chaqiradi. Bu real provayder webhookini
 * simulyatsiya qiladi — tranzaksiya yozuvi yaratiladi va xuddi shu markPaid() yo'li ishlatiladi.
 * Productionda (NODE_ENV=production) mavjud emas.
 */
r.post(
  '/sandbox/:id/complete',
  authenticate,
  validate({ body: z.object({ result: z.enum(['success', 'fail']) }) }),
  ah(async (req, res) => {
    if (!env.sandboxAllowed) throw Errors.notFound('Sahifa');
    const p = await ownPayment(req.params.id, req.user!.id, req.user!.role);
    if (p.provider !== 'sandbox') throw Errors.badRequest('Bu sandbox to\'lov emas');
    const txId = `sbx_${crypto.randomBytes(8).toString('hex')}`;
    if (req.body.result === 'fail') {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.create({
          data: { paymentId: p.id, provider: 'sandbox', providerTxId: txId, state: -1, amount: p.amount, createTime: BigInt(Date.now()), cancelTime: BigInt(Date.now()), rawPayload: { simulated: true, result: 'fail' } },
        });
        await markFailed(tx, p.id, 'Sandbox: foydalanuvchi bekor qildi');
      });
      return ok(res, { status: 'failed' });
    }
    await prisma.$transaction(async (tx) => {
      await tx.paymentTransaction.create({
        data: { paymentId: p.id, provider: 'sandbox', providerTxId: txId, state: 2, amount: p.amount, createTime: BigInt(Date.now()), performTime: BigInt(Date.now()), rawPayload: { simulated: true } },
      });
      await markPaid(tx, p.id);
    });
    void afterPaid(p.id);
    ok(res, { status: 'paid' });
  }),
);

/** Kvitansiya ma'lumotlari (frontend chop etiladigan ko'rinishda chiqaradi) */
r.get(
  '/:id/receipt',
  authenticate,
  ah(async (req, res) => {
    const p = await ownPayment(req.params.id, req.user!.id, req.user!.role);
    if (p.status !== 'paid' && p.status !== 'refunded' && p.status !== 'partially_refunded') throw Errors.badRequest("To'lov hali amalga oshmagan");
    const tx = await prisma.paymentTransaction.findFirst({ where: { paymentId: p.id, state: 2 } });
    ok(res, {
      receiptNo: `R-${p.order.orderNumber}`,
      paymentId: p.id,
      orderNumber: p.order.orderNumber,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      currency: p.currency,
      provider: p.provider,
      method: p.method,
      providerTxId: tx?.providerTxId ?? null,
      paidAt: p.paidAt,
      status: p.status,
      buyer: { name: p.order.recipientName, phone: p.order.contactPhone },
    });
  }),
);

export default r;
