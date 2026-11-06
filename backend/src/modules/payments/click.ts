import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { D } from '../../common/money';
import { safeEqual } from '../../common/utils';
import { logger } from '../../lib/logger';
import { afterPaid, markFailed, markPaid } from './payments.service';

/**
 * Click SHOP API: Prepare (action=0) va Complete (action=1).
 * Kabinetda: Prepare URL → {API}/api/v1/payments/click/prepare, Complete URL → .../click/complete
 * merchant_trans_id = AgroMarket Payment.id
 */
type ClickBody = Record<string, string | undefined>;

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

export function clickSign(b: ClickBody, withPrepareId: boolean) {
  return md5(
    `${b.click_trans_id}${b.service_id}${env.CLICK_SECRET_KEY}${b.merchant_trans_id}${withPrepareId ? b.merchant_prepare_id ?? '' : ''}${b.amount}${b.action}${b.sign_time}`,
  );
}

const reply = (res: Response, b: ClickBody, error: number, note: string, extra: Record<string, unknown> = {}) =>
  res.json({ click_trans_id: Number(b.click_trans_id), merchant_trans_id: b.merchant_trans_id, error, error_note: note, ...extra });

export async function clickPrepare(req: Request, res: Response) {
  const b = req.body as ClickBody;
  try {
    if (!env.clickEnabled || !b.sign_string || !safeEqual(clickSign(b, false), b.sign_string)) return reply(res, b, -1, 'SIGN CHECK FAILED');
    if (b.action !== '0') return reply(res, b, -3, 'Action not found');
    if (b.service_id !== env.CLICK_SERVICE_ID) return reply(res, b, -1, 'SIGN CHECK FAILED');
    const p = await prisma.payment.findUnique({ where: { id: String(b.merchant_trans_id) }, include: { order: true } });
    if (!p || p.provider !== 'click') return reply(res, b, -5, 'User does not exist');
    if (p.status === 'paid') return reply(res, b, -4, 'Already paid');
    if (!['pending', 'processing'].includes(p.status) || p.order.status === 'cancelled') return reply(res, b, -9, 'Transaction cancelled');
    if (!D(b.amount ?? '0').equals(p.amount)) return reply(res, b, -2, 'Incorrect parameter amount');

    const prepareId = Date.now();
    const t = await prisma.paymentTransaction.upsert({
      where: { provider_providerTxId: { provider: 'click', providerTxId: String(b.click_trans_id) } },
      create: {
        paymentId: p.id,
        provider: 'click',
        providerTxId: String(b.click_trans_id),
        state: 1,
        amount: p.amount,
        createTime: BigInt(prepareId),
        rawPayload: b as object,
      },
      update: {},
    });
    await prisma.payment.update({ where: { id: p.id }, data: { status: 'processing', providerPaymentId: String(b.click_trans_id) } });
    return reply(res, b, 0, 'Success', { merchant_prepare_id: Number(t.createTime) });
  } catch (e) {
    logger.error('click prepare', { err: (e as Error).stack });
    return reply(res, b, -7, 'Failed to update user');
  }
}

export async function clickComplete(req: Request, res: Response) {
  const b = req.body as ClickBody;
  try {
    if (!env.clickEnabled || !b.sign_string || !safeEqual(clickSign(b, true), b.sign_string)) return reply(res, b, -1, 'SIGN CHECK FAILED');
    if (b.action !== '1') return reply(res, b, -3, 'Action not found');
    const t = await prisma.paymentTransaction.findUnique({ where: { provider_providerTxId: { provider: 'click', providerTxId: String(b.click_trans_id) } } });
    if (!t || String(t.createTime) !== String(b.merchant_prepare_id) || t.paymentId !== b.merchant_trans_id) return reply(res, b, -6, 'Transaction does not exist');
    if (!D(b.amount ?? '0').equals(t.amount)) return reply(res, b, -2, 'Incorrect parameter amount');
    if (t.state === 2) return reply(res, b, -4, 'Already paid', { merchant_confirm_id: Number(t.createTime) });
    if (t.state < 0) return reply(res, b, -9, 'Transaction cancelled');

    // Click tomonida xato bo'lgan bo'lsa (error < 0) — tranzaksiyani bekor qilamiz
    if (Number(b.error) < 0) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({ where: { id: t.id }, data: { state: -1, cancelTime: BigInt(Date.now()) } });
        await markFailed(tx, t.paymentId, `Click error ${b.error}: ${b.error_note ?? ''}`);
      });
      return reply(res, b, -9, 'Transaction cancelled');
    }
    try {
      await prisma.$transaction(async (tx) => {
        const n = await tx.paymentTransaction.updateMany({ where: { id: t.id, state: 1 }, data: { state: 2, performTime: BigInt(Date.now()) } });
        if (n.count !== 1) throw new Error('state changed');
        await markPaid(tx, t.paymentId);
      });
    } catch (e) {
      logger.warn('click complete refused', { err: (e as Error).message });
      return reply(res, b, -9, 'Transaction cancelled');
    }
    void afterPaid(t.paymentId);
    return reply(res, b, 0, 'Success', { merchant_confirm_id: Number(t.createTime) });
  } catch (e) {
    logger.error('click complete', { err: (e as Error).stack });
    return reply(res, b, -7, 'Failed to update user');
  }
}
