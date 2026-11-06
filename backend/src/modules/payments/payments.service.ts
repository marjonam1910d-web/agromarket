import { prisma, type Tx } from '../../lib/prisma';
import { AppError, Errors } from '../../common/errors';
import { D } from '../../common/money';
import { notify } from '../notifications/notifications.service';
import { notifySellersNewOrder } from '../orders/checkout.service';
import { recomputeOrder, transitionSellerOrder } from '../orders/lifecycle';

/**
 * To'lov holatini o'zgartiruvchi YAGONA joy. Faqat provayder webhooki (imzosi tekshirilgan)
 * yoki sandbox provayderi chaqiradi — frontend javobiga asoslanib hech qachon "paid" qilinmaydi.
 */
export async function markPaid(tx: Tx, paymentId: string) {
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!p) throw Errors.notFound("To'lov");
  if (p.status === 'paid') return { already: true, payment: p };
  if (!['pending', 'processing'].includes(p.status)) throw new AppError(409, 'PAYMENT_NOT_PAYABLE', "To'lovni amalga oshirib bo'lmaydi");
  if (p.order.status === 'cancelled') throw new AppError(409, 'ORDER_CANCELLED', 'Buyurtma bekor qilingan');

  // Optimistik: faqat pending/processing holatidan o'tadi (ikki marta "paid" bo'lmaydi)
  const n = await tx.payment.updateMany({ where: { id: p.id, status: { in: ['pending', 'processing'] } }, data: { status: 'paid', paidAt: new Date() } });
  if (n.count !== 1) return { already: true, payment: p };
  await tx.order.update({ where: { id: p.orderId }, data: { paymentStatus: 'paid' } });
  // Boshqa ochiq urinishlarni bekor qilish
  await tx.payment.updateMany({ where: { orderId: p.orderId, id: { not: p.id }, status: { in: ['pending', 'processing'] } }, data: { status: 'cancelled' } });
  return { already: false, payment: p };
}

export async function afterPaid(paymentId: string) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!p) return;
  void notify({
    userId: p.order.buyerId,
    type: 'payment.result',
    key: 'payment.paid',
    params: { number: p.order.orderNumber, amount: p.amount.toFixed(0) },
    link: `/account/orders/${p.orderId}`,
  });
  await notifySellersNewOrder(p.orderId);
}

export async function markFailed(tx: Tx, paymentId: string, reason: string, status: 'failed' | 'cancelled' = 'failed') {
  const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!p || !['pending', 'processing'].includes(p.status)) return null;
  await tx.payment.update({ where: { id: p.id }, data: { status, failureReason: reason } });
  return p;
}

/**
 * Pulni qaytarish. Sandbox — avtomatik. Payme/Click — pul provayder kabinetida qaytariladi
 * (Payme'da bekor qilishni Payme tomoni CancelTransaction orqali chaqiradi), admin esa bu yerda
 * qaytarish bajarilganini tasdiqlaydi. Har bir qadam audit logga yoziladi.
 */
export async function processRefund(refundId: string, adminId: string, approve: boolean, note?: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.refund.findUnique({ where: { id: refundId }, include: { payment: { include: { order: true } } } });
    if (!r) throw Errors.notFound("Qaytarish so'rovi");
    if (!['requested', 'approved'].includes(r.status)) throw new AppError(409, 'REFUND_DONE', "So'rov allaqachon ko'rib chiqilgan");

    if (!approve) {
      await tx.refund.update({ where: { id: r.id }, data: { status: 'rejected', processedById: adminId, processedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'refund.reject', entityType: 'Refund', entityId: r.id, meta: { note } } });
      return { status: 'rejected' };
    }
    const pay = r.payment;
    const refunded = pay.refundedAmount.add(r.amount);
    if (refunded.greaterThan(pay.amount)) throw new AppError(409, 'REFUND_EXCEEDS', "Qaytarish summasi to'lovdan oshib ketadi");
    const full = refunded.equals(pay.amount);

    await tx.refund.update({ where: { id: r.id }, data: { status: 'processed', processedById: adminId, processedAt: new Date() } });
    await tx.payment.update({ where: { id: pay.id }, data: { refundedAmount: refunded, status: full ? 'refunded' : 'partially_refunded' } });
    await tx.order.update({ where: { id: pay.orderId }, data: { paymentStatus: full ? 'refunded' : 'partially_refunded' } });
    if (r.sellerOrderId) {
      const so = await tx.sellerOrder.findUnique({ where: { id: r.sellerOrderId } });
      if (so && so.status === 'cancelled') {
        await tx.sellerOrder.update({ where: { id: so.id }, data: { status: 'refunded' } });
        await tx.orderStatusHistory.create({ data: { orderId: so.orderId, sellerOrderId: so.id, fromStatus: 'cancelled', toStatus: 'refunded', actorId: adminId, note } });
      }
    }
    await recomputeOrder(tx, pay.orderId);
    await tx.auditLog.create({
      data: { actorId: adminId, action: 'refund.process', entityType: 'Refund', entityId: r.id, meta: { amount: r.amount.toString(), provider: pay.provider, note } },
    });
    void notify({
      userId: pay.order.buyerId,
      type: 'payment.result',
      key: 'refund.processed',
      params: { amount: r.amount.toFixed(0), number: pay.order.orderNumber },
      link: `/account/orders/${pay.orderId}`,
    });
    return { status: 'processed', provider: pay.provider, manual: pay.provider !== 'sandbox' };
  });
}

/** Provayder to'langan tranzaksiyani bekor qilganda (masalan Payme CancelTransaction, state 2 → -2) */
export async function providerReversal(tx: Tx, paymentId: string, reason: string) {
  const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: { include: { sellerOrders: true } } } });
  await tx.payment.update({ where: { id: p.id }, data: { status: 'refunded', refundedAmount: p.amount } });
  await tx.order.update({ where: { id: p.orderId }, data: { paymentStatus: 'refunded' } });
  for (const so of p.order.sellerOrders) {
    if (!['cancelled', 'refunded', 'delivered'].includes(so.status)) {
      await transitionSellerOrder(tx, so.id, 'cancelled', { id: null, role: 'SYSTEM' }, { reason });
    }
  }
  await tx.refund.create({ data: { paymentId: p.id, amount: p.amount, reason, status: 'processed', processedAt: new Date() } });
  await recomputeOrder(tx, p.orderId);
}

export const ZERO_SOM = D(0);
