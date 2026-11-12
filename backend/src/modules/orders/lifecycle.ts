import type { DeliveryStatus, OrderStatus, Role } from '@prisma/client';
import { type Tx } from '../../lib/prisma';
import { AppError, Errors } from '../../common/errors';
import { syncStockStatus } from '../products/products.service';
import { settleSellerWallet } from '../wallet/wallet.service';

/**
 * Buyurtma holatlari mashinasi (SellerOrder darajasida). Barcha o'tishlar faqat backendda tekshiriladi.
 *
 *  pending → confirmed → preparing → ready_for_delivery → shipped → delivered → (refunded)
 *     ↘ cancelled  ↘ cancelled  ↘ cancelled
 */
export const RANK: Record<OrderStatus, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready_for_delivery: 3,
  shipped: 4,
  delivered: 5,
  cancelled: 9,
  refunded: 10,
};

const SELLER_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['shipped'],
  shipped: ['delivered'],
};

const BUYER_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['cancelled'],
  confirmed: ['cancelled'],
  shipped: ['delivered'], // xaridor qabul qilganini tasdiqlaydi
};

const ADMIN_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
};

export function allowedTransitions(role: Role | 'SYSTEM', from: OrderStatus): OrderStatus[] {
  if (role === 'SYSTEM') return ['cancelled'];
  const map = role === 'ADMIN' ? ADMIN_FLOW : role === 'SELLER' ? SELLER_FLOW : BUYER_FLOW;
  return map[from] ?? [];
}

const DELIVERY_MAP: Partial<Record<OrderStatus, DeliveryStatus>> = {
  confirmed: 'scheduled',
  shipped: 'in_transit',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

export interface Actor {
  id: string | null;
  role: Role | 'SYSTEM';
}

export interface TransitionOpts {
  note?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  reason?: string | null;
}

/**
 * Bitta SellerOrder holatini o'zgartiradi. Optimistik qulf: `updateMany where status = from`
 * — ikki parallel so'rov bir xil o'tishni ikki marta bajara olmaydi.
 */
export async function transitionSellerOrder(tx: Tx, sellerOrderId: string, to: OrderStatus, actor: Actor, opts: TransitionOpts = {}) {
  const so = await tx.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: { order: { select: { id: true, paymentMethod: true, paymentStatus: true, buyerId: true } }, items: true, delivery: true },
  });
  if (!so) throw Errors.notFound('Buyurtma');
  const from = so.status;
  if (!allowedTransitions(actor.role, from).includes(to)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Holatni "${from}" dan "${to}" ga o'zgartirib bo'lmaydi`);
  }
  // Onlayn to'lov qilinmagan buyurtmani sotuvchi tasdiqlay olmaydi
  if (to === 'confirmed' && so.order.paymentMethod !== 'cash' && so.order.paymentStatus !== 'paid') {
    throw new AppError(409, 'PAYMENT_REQUIRED', "Buyurtma hali to'lanmagan");
  }
  if (to === 'shipped' && !(opts.courierName || so.delivery?.courierName)) {
    throw new AppError(422, 'COURIER_REQUIRED', "Jo'natish uchun kuryer (yoki yetkazuvchi) ma'lumotini kiriting");
  }

  const moved = await tx.sellerOrder.updateMany({
    where: { id: so.id, status: from },
    data: { status: to, ...(to === 'cancelled' ? { rejectionReason: opts.reason ?? opts.note ?? null } : {}) },
  });
  if (moved.count !== 1) throw new AppError(409, 'CONCURRENT_UPDATE', "Buyurtma holati boshqa so'rov bilan o'zgardi. Sahifani yangilang");

  await tx.orderStatusHistory.create({
    data: { orderId: so.orderId, sellerOrderId: so.id, fromStatus: from, toStatus: to, note: opts.reason ?? opts.note ?? null, actorId: actor.id },
  });

  // Bekor qilinganda — zaxira qaytariladi (tranzaksiya ichida, atomik increment)
  if (to === 'cancelled') {
    for (const it of so.items) {
      await tx.productInventory.updateMany({ where: { productId: it.productId }, data: { quantity: { increment: it.quantity } } });
      await syncStockStatus(tx, it.productId);
    }
  }
  if (to === 'delivered') {
    for (const it of so.items) {
      await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: it.quantity } } });
    }
    await settleSellerWallet(tx, so);
  }

  // Yetkazish yozuvi va tarixi
  if (so.delivery) {
    const ds = DELIVERY_MAP[to];
    if (ds) {
      await tx.delivery.update({
        where: { id: so.delivery.id },
        data: {
          status: ds,
          ...(opts.courierName ? { courierName: opts.courierName } : {}),
          ...(opts.courierPhone ? { courierPhone: opts.courierPhone } : {}),
          ...(to === 'shipped' ? { shippedAt: new Date() } : {}),
          ...(to === 'delivered' ? { deliveredAt: new Date() } : {}),
        },
      });
      await tx.deliveryStatusHistory.create({ data: { deliveryId: so.delivery.id, status: ds, note: opts.note ?? null, actorId: actor.id } });
    }
  }

  // Onlayn to'langan buyurtma bekor qilinsa — avtomatik refund so'rovi
  if (to === 'cancelled' && so.order.paymentStatus === 'paid' && so.order.paymentMethod !== 'cash') {
    const payment = await tx.payment.findFirst({ where: { orderId: so.orderId, status: { in: ['paid', 'partially_refunded'] } } });
    if (payment) {
      await tx.refund.create({ data: { paymentId: payment.id, sellerOrderId: so.id, amount: so.total, reason: opts.reason ?? 'Buyurtma bekor qilindi' } });
    }
  }

  await recomputeOrder(tx, so.orderId);
  return { from, to, sellerOrder: so };
}

/** Ota buyurtma holati — ichki buyurtmalardan hosil qilinadi */
export async function recomputeOrder(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { sellerOrders: { select: { status: true } } } });
  const statuses = order.sellerOrders.map((s) => s.status);
  const active = statuses.filter((s) => s !== 'cancelled' && s !== 'refunded');
  let next: OrderStatus;
  if (!active.length) next = statuses.includes('refunded') ? 'refunded' : 'cancelled';
  else next = active.reduce((m, s) => (RANK[s] < RANK[m] ? s : m), active[0]);

  const data: Record<string, unknown> = {};
  if (next !== order.status) {
    data.status = next;
    if (next === 'cancelled') data.cancelledAt = new Date();
    await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: next, note: 'auto' } });
  }
  // Naqd to'lov: barcha faol qismlar yetkazilganda — to'langan deb belgilanadi
  if (order.paymentMethod === 'cash' && next === 'delivered' && order.paymentStatus !== 'paid') {
    data.paymentStatus = 'paid';
    await tx.payment.updateMany({ where: { orderId, provider: 'cash' }, data: { status: 'paid', paidAt: new Date() } });
  }
  if (order.paymentMethod === 'cash' && next === 'cancelled' && order.paymentStatus === 'pending') {
    data.paymentStatus = 'cancelled';
    await tx.payment.updateMany({ where: { orderId, provider: 'cash' }, data: { status: 'cancelled' } });
  }
  if (Object.keys(data).length) await tx.order.update({ where: { id: orderId }, data });
  return next;
}
