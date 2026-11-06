import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, validate, q } from '../../common/http';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';
import { authenticate, requireRole, requireSeller, sellerId } from '../../middleware/auth';

/** Barcha ko'rsatkichlar real DB so'rovlaridan olinadi (Asia/Tashkent vaqt zonasi bo'yicha guruhlanadi). */
const r = Router();

const rangeQ = z.object({ period: z.enum(['day', 'week', 'month']).default('day'), days: z.coerce.number().int().min(7).max(365).default(30) });

type Row = { bucket: Date; revenue: Prisma.Decimal | null; orders: bigint };

function series(rows: Row[]) {
  return rows.map((x) => ({ date: x.bucket.toISOString().slice(0, 10), revenue: Number(x.revenue ?? 0), orders: Number(x.orders) }));
}

const trunc = (p: 'day' | 'week' | 'month') => Prisma.raw(`'${p}'`);

// ───────── Sotuvchi analitikasi ─────────
r.get(
  '/seller/overview',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const sid = sellerId(req);
    const delivered = { sellerId: sid, status: 'delivered' as const };
    const [sales, ordersTotal, active, outOfStock, seller, statusCounts, pendingCount, lowStock] = await Promise.all([
      prisma.sellerOrder.aggregate({ where: delivered, _sum: { total: true, sellerPayout: true }, _count: { _all: true } }),
      prisma.sellerOrder.count({ where: { sellerId: sid, status: { notIn: ['cancelled'] } } }),
      prisma.product.count({ where: { sellerId: sid, status: 'active', deletedAt: null } }),
      prisma.product.count({ where: { sellerId: sid, status: 'out_of_stock', deletedAt: null } }),
      prisma.sellerProfile.findUniqueOrThrow({ where: { id: sid }, select: { ratingAvg: true, ratingCount: true, verificationStatus: true } }),
      prisma.sellerOrder.groupBy({ by: ['status'], where: { sellerId: sid }, _count: { _all: true } }),
      prisma.sellerOrder.count({ where: { sellerId: sid, status: 'pending', order: { OR: [{ paymentMethod: 'cash' }, { paymentStatus: 'paid' }] } } }),
      prisma.$queryRaw<{ id: string; name: string; quantity: Prisma.Decimal; unit: string; threshold: Prisma.Decimal }[]>`
        SELECT p.id, p.name, i.quantity, p.unit::text AS unit, i."lowStockThreshold" AS threshold
        FROM "Product" p JOIN "ProductInventory" i ON i."productId" = p.id
        WHERE p."sellerId" = ${sid} AND p."deletedAt" IS NULL AND p.status IN ('active','out_of_stock') AND i.quantity <= i."lowStockThreshold"
        ORDER BY i.quantity ASC LIMIT 10`,
    ]);
    ok(res, {
      cards: {
        totalSales: sales._sum.total ?? 0,
        revenue: sales._sum.sellerPayout ?? 0,
        deliveredOrders: sales._count._all,
        totalOrders: ordersTotal,
        newOrders: pendingCount,
        activeProducts: active,
        outOfStockProducts: outOfStock,
        averageRating: seller.ratingAvg,
        ratingCount: seller.ratingCount,
      },
      verificationStatus: seller.verificationStatus,
      orderStatuses: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
      stockAlerts: lowStock,
    });
  }),
);

r.get(
  '/seller/sales',
  authenticate,
  requireSeller,
  validate({ query: rangeQ }),
  ah(async (req, res) => {
    const f = q(req, rangeQ);
    const sid = sellerId(req);
    const since = new Date(Date.now() - f.days * 86400_000);
    const [rows, best] = await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc(f.period)}, so."createdAt" AT TIME ZONE 'Asia/Tashkent') AS bucket,
               SUM(so.total) AS revenue, COUNT(*) AS orders
        FROM "SellerOrder" so
        WHERE so."sellerId" = ${sid} AND so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ productId: string; name: string; qty: Prisma.Decimal; revenue: Prisma.Decimal; unit: string }[]>`
        SELECT oi."productId", MAX(oi."productName") AS name, SUM(oi.quantity) AS qty, SUM(oi."lineTotal") AS revenue, MAX(oi.unit::text) AS unit
        FROM "OrderItem" oi JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        WHERE so."sellerId" = ${sid} AND so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY oi."productId" ORDER BY revenue DESC LIMIT 10`,
    ]);
    ok(res, { series: series(rows), bestSellers: best.map((b) => ({ ...b, qty: Number(b.qty), revenue: Number(b.revenue) })) });
  }),
);

// ───────── Admin analitikasi ─────────
r.get(
  '/admin/overview',
  authenticate,
  requireRole('ADMIN'),
  ah(async (_req, res) => {
    const [users, buyers, sellersActive, sellersPending, productsActive, productsPending, orders, gmv, paid, complaints, refunds] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'BUYER', deletedAt: null } }),
      prisma.sellerProfile.count({ where: { verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } } }),
      prisma.sellerProfile.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.product.count({ where: { status: 'active', deletedAt: null } }),
      prisma.product.count({ where: { status: 'pending_review', deletedAt: null } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: 'delivered' }, _sum: { total: true } }),
      prisma.payment.aggregate({ where: { status: { in: ['paid', 'partially_refunded'] } }, _sum: { amount: true } }),
      prisma.complaint.count({ where: { status: { in: ['open', 'in_review'] } } }),
      prisma.refund.count({ where: { status: 'requested' } }),
    ]);
    const commission = await prisma.sellerOrder.aggregate({ where: { status: 'delivered' }, _sum: { commissionAmount: true } });
    ok(res, {
      totalUsers: users,
      buyers,
      activeSellers: sellersActive,
      pendingSellers: sellersPending,
      activeProducts: productsActive,
      pendingProducts: productsPending,
      totalOrders: orders,
      totalSales: gmv._sum.total ?? 0,
      paymentVolume: paid._sum.amount ?? 0,
      commissionEarned: commission._sum.commissionAmount ?? 0,
      openComplaints: complaints,
      pendingRefunds: refunds,
    });
  }),
);

r.get(
  '/admin/sales',
  authenticate,
  requireRole('ADMIN'),
  validate({ query: rangeQ }),
  ah(async (req, res) => {
    const f = q(req, rangeQ);
    const since = new Date(Date.now() - f.days * 86400_000);
    const [rows, byCategory, topSellers, topProducts, byRegion] = await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT date_trunc(${trunc(f.period)}, o."createdAt" AT TIME ZONE 'Asia/Tashkent') AS bucket, SUM(o.total) AS revenue, COUNT(*) AS orders
        FROM "Order" o WHERE o.status NOT IN ('cancelled','refunded') AND o."createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ slug: string; nameUz: string; nameRu: string; nameEn: string; revenue: Prisma.Decimal }[]>`
        SELECT COALESCE(pc.slug, c.slug) AS slug, MAX(COALESCE(pc."nameUz", c."nameUz")) AS "nameUz", MAX(COALESCE(pc."nameRu", c."nameRu")) AS "nameRu",
               MAX(COALESCE(pc."nameEn", c."nameEn")) AS "nameEn", SUM(oi."lineTotal") AS revenue
        FROM "OrderItem" oi JOIN "Product" p ON p.id = oi."productId" JOIN "Category" c ON c.id = p."categoryId"
        LEFT JOIN "Category" pc ON pc.id = c."parentId"
        JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        WHERE so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 8`,
      prisma.$queryRaw<{ id: string; farmName: string; revenue: Prisma.Decimal; orders: bigint }[]>`
        SELECT s.id, s."farmName", SUM(so.total) AS revenue, COUNT(*) AS orders
        FROM "SellerOrder" so JOIN "SellerProfile" s ON s.id = so."sellerId"
        WHERE so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY s.id ORDER BY revenue DESC LIMIT 10`,
      prisma.$queryRaw<{ productId: string; name: string; revenue: Prisma.Decimal; qty: Prisma.Decimal }[]>`
        SELECT oi."productId", MAX(oi."productName") AS name, SUM(oi."lineTotal") AS revenue, SUM(oi.quantity) AS qty
        FROM "OrderItem" oi JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        WHERE so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
      prisma.$queryRaw<{ region: string; revenue: Prisma.Decimal; orders: bigint }[]>`
        SELECT o.region, SUM(o.total) AS revenue, COUNT(*) AS orders FROM "Order" o
        WHERE o.status NOT IN ('cancelled','refunded') AND o."createdAt" >= ${since}
        GROUP BY 1 ORDER BY revenue DESC`,
    ]);
    const num = <T extends Record<string, unknown>>(x: T) =>
      Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v instanceof Prisma.Decimal || typeof v === 'bigint' ? Number(v) : v]));
    ok(res, {
      series: series(rows),
      byCategory: byCategory.map(num),
      topSellers: topSellers.map(num),
      topProducts: topProducts.map(num),
      byRegion: byRegion.map(num),
    });
  }),
);

/** Landing sahifasi uchun ommaviy statistika (5 daqiqa kesh) */
r.get(
  '/public/stats',
  ah(async (_req, res) => {
    const data = await cache.wrap('stats:public', 300, async () => {
      const [farmers, products, buyers, delivered, regions] = await Promise.all([
        prisma.sellerProfile.count({ where: { verificationStatus: 'APPROVED' } }),
        prisma.product.count({ where: { status: 'active', deletedAt: null } }),
        prisma.user.count({ where: { role: 'BUYER', deletedAt: null } }),
        prisma.order.count({ where: { status: 'delivered' } }),
        prisma.sellerProfile.groupBy({ by: ['region'], where: { verificationStatus: 'APPROVED' } }),
      ]);
      return { farmers, products, buyers, deliveredOrders: delivered, regions: regions.length };
    });
    ok(res, data);
  }),
);

export default r;
