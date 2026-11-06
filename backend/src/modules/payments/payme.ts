import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { D } from '../../common/money';
import { safeEqual } from '../../common/utils';
import { logger } from '../../lib/logger';
import { afterPaid, markFailed, markPaid, providerReversal } from './payments.service';

/**
 * Payme Merchant API (JSON-RPC 2.0). Hujjat: https://developer.help.paycom.uz
 * Kabinetda hisob maydoni (account) nomi: order_id  → qiymati AgroMarket Payment.id
 * Barcha javoblar HTTP 200, xatolar `error` obyektida.
 */
const TIMEOUT_MS = 12 * 3600 * 1000; // 12 soat — Payme talabi

class PaymeError extends Error {
  constructor(public code: number, public uz: string, public ru: string, public en: string, public data?: string) {
    super(en);
  }
}
const E = {
  auth: () => new PaymeError(-32504, "Ruxsat yo'q", 'Недостаточно привилегий', 'Insufficient privileges'),
  method: () => new PaymeError(-32601, 'Metod topilmadi', 'Метод не найден', 'Method not found'),
  parse: () => new PaymeError(-32700, "So'rov formati xato", 'Ошибка разбора', 'Parse error'),
  amount: () => new PaymeError(-31001, "Summa noto'g'ri", 'Неверная сумма', 'Incorrect amount'),
  txNotFound: () => new PaymeError(-31003, 'Tranzaksiya topilmadi', 'Транзакция не найдена', 'Transaction not found'),
  cantCancel: () => new PaymeError(-31007, "Bekor qilib bo'lmaydi", 'Невозможно отменить транзакцию', 'Unable to cancel'),
  cantPerform: () => new PaymeError(-31008, "Amalni bajarib bo'lmaydi", 'Невозможно выполнить операцию', 'Unable to perform'),
  order: () => new PaymeError(-31050, 'Buyurtma topilmadi', 'Заказ не найден', 'Order not found', 'order_id'),
  orderState: () => new PaymeError(-31051, "Buyurtmani to'lab bo'lmaydi", 'Заказ нельзя оплатить', 'Order cannot be paid', 'order_id'),
  busy: () => new PaymeError(-31099, "Buyurtma boshqa tranzaksiya bilan band", 'Заказ ожидает оплаты', 'Order is awaiting another payment', 'order_id'),
};

export function checkPaymeAuth(header?: string): boolean {
  if (!header?.startsWith('Basic ') || !env.PAYME_KEY) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const i = decoded.indexOf(':');
  if (i < 0) return false;
  return decoded.slice(0, i) === 'Paycom' && safeEqual(decoded.slice(i + 1), env.PAYME_KEY);
}

async function findPayable(account: { order_id?: string } | undefined, amountTiyin: number) {
  const id = account?.order_id;
  if (!id) throw E.order();
  const p = await prisma.payment.findUnique({ where: { id }, include: { order: true } });
  if (!p || p.provider !== 'payme') throw E.order();
  if (!D(amountTiyin).equals(p.amount.mul(100))) throw E.amount();
  if (!['pending', 'processing'].includes(p.status) || p.order.status === 'cancelled') throw E.orderState();
  return p;
}

const txView = (t: { id: string; createTime: bigint; performTime: bigint; cancelTime: bigint; state: number; reason: number | null }) => ({
  create_time: Number(t.createTime),
  perform_time: Number(t.performTime),
  cancel_time: Number(t.cancelTime),
  transaction: t.id,
  state: t.state,
  reason: t.reason,
});

async function expire(txId: string, paymentId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.paymentTransaction.update({ where: { id: txId }, data: { state: -1, reason: 4, cancelTime: BigInt(Date.now()) } });
    await markFailed(tx, paymentId, 'Payme: timeout', 'cancelled');
  });
}

type P = Record<string, unknown> & { id?: string; amount?: number; account?: { order_id?: string }; time?: number; reason?: number; from?: number; to?: number };

async function dispatch(method: string, params: P) {
  switch (method) {
    case 'CheckPerformTransaction': {
      await findPayable(params.account, Number(params.amount));
      return { allow: true };
    }
    case 'CreateTransaction': {
      const existing = await prisma.paymentTransaction.findUnique({ where: { provider_providerTxId: { provider: 'payme', providerTxId: String(params.id) } } });
      if (existing) {
        if (existing.state !== 1) throw E.cantPerform();
        if (Date.now() - Number(existing.createTime) > TIMEOUT_MS) {
          await expire(existing.id, existing.paymentId);
          throw E.cantPerform();
        }
        return { create_time: Number(existing.createTime), transaction: existing.id, state: existing.state };
      }
      const p = await findPayable(params.account, Number(params.amount));
      const active = await prisma.paymentTransaction.findFirst({ where: { paymentId: p.id, state: 1 } });
      if (active) throw E.busy();
      const t = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentTransaction.create({
          data: {
            paymentId: p.id,
            provider: 'payme',
            providerTxId: String(params.id),
            state: 1,
            amount: p.amount,
            createTime: BigInt(Number(params.time) || Date.now()),
            rawPayload: params as object,
          },
        });
        await tx.payment.update({ where: { id: p.id }, data: { status: 'processing', providerPaymentId: String(params.id) } });
        return created;
      });
      return { create_time: Number(t.createTime), transaction: t.id, state: 1 };
    }
    case 'PerformTransaction': {
      const t = await prisma.paymentTransaction.findUnique({ where: { provider_providerTxId: { provider: 'payme', providerTxId: String(params.id) } } });
      if (!t) throw E.txNotFound();
      if (t.state === 2) return { transaction: t.id, perform_time: Number(t.performTime), state: 2 };
      if (t.state !== 1) throw E.cantPerform();
      if (Date.now() - Number(t.createTime) > TIMEOUT_MS) {
        await expire(t.id, t.paymentId);
        throw E.cantPerform();
      }
      const performTime = BigInt(Date.now());
      try {
        await prisma.$transaction(async (tx) => {
          const n = await tx.paymentTransaction.updateMany({ where: { id: t.id, state: 1 }, data: { state: 2, performTime } });
          if (n.count !== 1) throw E.cantPerform();
          await markPaid(tx, t.paymentId);
        });
      } catch (e) {
        if (e instanceof PaymeError) throw e;
        logger.warn('payme perform failed', { err: (e as Error).message });
        throw E.cantPerform();
      }
      void afterPaid(t.paymentId);
      return { transaction: t.id, perform_time: Number(performTime), state: 2 };
    }
    case 'CancelTransaction': {
      const t = await prisma.paymentTransaction.findUnique({ where: { provider_providerTxId: { provider: 'payme', providerTxId: String(params.id) } } });
      if (!t) throw E.txNotFound();
      if (t.state < 0) return { transaction: t.id, cancel_time: Number(t.cancelTime), state: t.state };
      const cancelTime = BigInt(Date.now());
      if (t.state === 1) {
        await prisma.$transaction(async (tx) => {
          await tx.paymentTransaction.update({ where: { id: t.id }, data: { state: -1, cancelTime, reason: Number(params.reason) || null } });
          await markFailed(tx, t.paymentId, `Payme cancel reason ${params.reason}`, 'cancelled');
        });
        return { transaction: t.id, cancel_time: Number(cancelTime), state: -1 };
      }
      // state === 2: to'langan — yetkazilgan buyurtmani bekor qilib bo'lmaydi
      const delivered = await prisma.sellerOrder.count({ where: { order: { payments: { some: { id: t.paymentId } } }, status: 'delivered' } });
      if (delivered > 0) throw E.cantCancel();
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({ where: { id: t.id }, data: { state: -2, cancelTime, reason: Number(params.reason) || null } });
        await providerReversal(tx, t.paymentId, `Payme reversal (reason ${params.reason})`);
      });
      return { transaction: t.id, cancel_time: Number(cancelTime), state: -2 };
    }
    case 'CheckTransaction': {
      const t = await prisma.paymentTransaction.findUnique({ where: { provider_providerTxId: { provider: 'payme', providerTxId: String(params.id) } } });
      if (!t) throw E.txNotFound();
      return txView(t);
    }
    case 'GetStatement': {
      const list = await prisma.paymentTransaction.findMany({
        where: { provider: 'payme', createTime: { gte: BigInt(Number(params.from) || 0), lte: BigInt(Number(params.to) || Date.now()) } },
        orderBy: { createTime: 'asc' },
      });
      return {
        transactions: list.map((t) => ({
          id: t.providerTxId,
          time: Number(t.createTime),
          amount: Number(t.amount.mul(100).toFixed(0)),
          account: { order_id: t.paymentId },
          ...txView(t),
        })),
      };
    }
    default:
      throw E.method();
  }
}

export async function paymeWebhook(req: Request, res: Response) {
  const body = req.body as { id?: number | string; method?: string; params?: P };
  const id = body?.id ?? null;
  const fail = (e: PaymeError) =>
    res.status(200).json({ jsonrpc: '2.0', id, error: { code: e.code, message: { uz: e.uz, ru: e.ru, en: e.en }, data: e.data } });

  if (!checkPaymeAuth(req.headers.authorization)) return fail(E.auth());
  if (!body?.method) return fail(E.parse());
  try {
    const result = await dispatch(body.method, body.params ?? {});
    return res.status(200).json({ jsonrpc: '2.0', id, result });
  } catch (e) {
    if (e instanceof PaymeError) return fail(e);
    logger.error('payme webhook error', { err: (e as Error).stack });
    return fail(E.cantPerform());
  }
}
