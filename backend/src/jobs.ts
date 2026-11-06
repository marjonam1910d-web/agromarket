import { prisma } from './lib/prisma';
import { env } from './config/env';
import { logger } from './lib/logger';
import { transitionSellerOrder } from './modules/orders/lifecycle';
import { notify } from './modules/notifications/notifications.service';

/**
 * Fon vazifalari:
 *  - to'lanmagan onlayn buyurtmalarni UNPAID_ORDER_TTL_MIN daqiqadan keyin bekor qilish
 *    (zaxira omborga qaytariladi — mahsulot "band" bo'lib qolmaydi),
 *  - eskirgan OTP va sessiyalarni tozalash.
 * Bir nechta instansiyada Postgres advisory lock bilan faqat bittasi bajaradi.
 */
const LOCK_ID = 774411;

export async function expireUnpaidOrders(now = new Date()) {
  const cutoff = new Date(now.getTime() - env.UNPAID_ORDER_TTL_MIN * 60_000);
  const orders = await prisma.order.findMany({
    where: {
      paymentMethod: { not: 'cash' },
      paymentStatus: 'pending',
      status: 'pending',
      createdAt: { lt: cutoff },
      // Provayderda jarayondagi (processing) to'lov bo'lsa — kutamiz
      payments: { none: { status: 'processing' } },
    },
    select: { id: true, buyerId: true, orderNumber: true, sellerOrders: { select: { id: true, status: true } } },
    take: 100,
  });
  for (const o of orders) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const so of o.sellerOrders) {
          if (so.status === 'pending') await transitionSellerOrder(tx, so.id, 'cancelled', { id: null, role: 'SYSTEM' }, { reason: "To'lov muddati tugadi" });
        }
        await tx.payment.updateMany({ where: { orderId: o.id, status: 'pending' }, data: { status: 'cancelled', failureReason: 'timeout' } });
        await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'cancelled' } });
      });
      void notify({ userId: o.buyerId, type: 'payment.result', key: 'payment.failed', params: { number: o.orderNumber }, link: `/account/orders/${o.id}` });
    } catch (e) {
      logger.warn('expire order failed', { order: o.id, err: (e as Error).message });
    }
  }
  return orders.length;
}

async function cleanup() {
  const day = new Date(Date.now() - 24 * 3600_000);
  await prisma.otpCode.deleteMany({ where: { createdAt: { lt: day } } });
  await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: day } }] } });
}

async function tick() {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${LOCK_ID}) AS locked`;
  if (!locked) return;
  try {
    const n = await expireUnpaidOrders();
    if (n) logger.info(`expired ${n} unpaid orders`);
    await cleanup();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
  }
}

export function startJobs() {
  const t = setInterval(() => tick().catch((e) => logger.warn('job tick', { err: (e as Error).message })), 60_000);
  t.unref();
  return () => clearInterval(t);
}
