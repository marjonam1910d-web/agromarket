import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, validate, q } from '../../common/http';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';
import { AppError, Errors } from '../../common/errors';
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


// ───────── Kategoriyalar bo'yicha hisobot (admin: butun platforma, sotuvchi: o'z do'koni) ─────────
const catQ = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });

function scope(req: import('express').Request) {
  if (req.user!.role === 'ADMIN') return null;
  if (!req.user!.sellerId) throw new AppError(403, 'FORBIDDEN', "Hisobot faqat sotuvchi va admin uchun");
  return req.user!.sellerId;
}
const sellerFilter = (sid: string | null) => (sid ? Prisma.sql`AND so."sellerId" = ${sid}` : Prisma.empty);
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? 100 : 0);

r.get(
  '/categories',
  authenticate,
  validate({ query: catQ }),
  ah(async (req, res) => {
    const f = q(req, catQ);
    const sid = scope(req);
    const now = Date.now();
    const since = new Date(now - f.days * 86400_000);
    const prevSince = new Date(now - 2 * f.days * 86400_000);
    type R = { root: string; revenue: Prisma.Decimal | null; orders: bigint; qty: Prisma.Decimal | null; buyers: bigint; prev_revenue: Prisma.Decimal | null; prev_orders: bigint };
    const [rows, cats, products, ratings] = await Promise.all([
      prisma.$queryRaw<R[]>`
        SELECT COALESCE(c."parentId", c.id) AS root,
          SUM(oi."lineTotal") FILTER (WHERE so."createdAt" >= ${since}) AS revenue,
          COUNT(DISTINCT so.id) FILTER (WHERE so."createdAt" >= ${since}) AS orders,
          SUM(oi.quantity) FILTER (WHERE so."createdAt" >= ${since}) AS qty,
          COUNT(DISTINCT o."buyerId") FILTER (WHERE so."createdAt" >= ${since}) AS buyers,
          SUM(oi."lineTotal") FILTER (WHERE so."createdAt" < ${since}) AS prev_revenue,
          COUNT(DISTINCT so.id) FILTER (WHERE so."createdAt" < ${since}) AS prev_orders
        FROM "OrderItem" oi
        JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        WHERE so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${prevSince} ${sellerFilter(sid)}
        GROUP BY 1`,
      prisma.category.findMany({ where: { parentId: null, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, icon: true, imageUrl: true } }),
      prisma.$queryRaw<{ root: string; active: bigint; sellers: bigint; stock: Prisma.Decimal | null }[]>`
        SELECT COALESCE(c."parentId", c.id) AS root, COUNT(*) FILTER (WHERE p.status = 'active') AS active,
               COUNT(DISTINCT p."sellerId") AS sellers, SUM(i.quantity) AS stock
        FROM "Product" p JOIN "Category" c ON c.id = p."categoryId" LEFT JOIN "ProductInventory" i ON i."productId" = p.id
        WHERE p."deletedAt" IS NULL ${sid ? Prisma.sql`AND p."sellerId" = ${sid}` : Prisma.empty}
        GROUP BY 1`,
      prisma.$queryRaw<{ root: string; avg: number | null; cnt: bigint }[]>`
        SELECT COALESCE(c."parentId", c.id) AS root, AVG(rv.rating)::float AS avg, COUNT(*) AS cnt
        FROM "Review" rv JOIN "Product" p ON p.id = rv."productId" JOIN "Category" c ON c.id = p."categoryId"
        WHERE rv.status = 'published' ${sid ? Prisma.sql`AND p."sellerId" = ${sid}` : Prisma.empty}
        GROUP BY 1`,
    ]);
    const byRoot = new Map(rows.map((x) => [x.root, x]));
    const prodBy = new Map(products.map((x) => [x.root, x]));
    const rateBy = new Map(ratings.map((x) => [x.root, x]));
    const totalRevenue = rows.reduce((a, x) => a + Number(x.revenue ?? 0), 0);
    const list = cats.map((c) => {
      const x = byRoot.get(c.id);
      const pr = prodBy.get(c.id);
      const rt = rateBy.get(c.id);
      const revenue = Number(x?.revenue ?? 0);
      const orders = Number(x?.orders ?? 0);
      return {
        ...c,
        revenue,
        orders,
        quantity: Number(x?.qty ?? 0),
        buyers: Number(x?.buyers ?? 0),
        averageOrder: orders ? Math.round(revenue / orders) : 0,
        share: totalRevenue ? Math.round((revenue / totalRevenue) * 1000) / 10 : 0,
        growth: pct(revenue, Number(x?.prev_revenue ?? 0)),
        ordersGrowth: pct(orders, Number(x?.prev_orders ?? 0)),
        activeProducts: Number(pr?.active ?? 0),
        sellers: Number(pr?.sellers ?? 0),
        stock: Number(pr?.stock ?? 0),
        rating: rt?.avg ? Math.round(rt.avg * 10) / 10 : null,
        reviews: Number(rt?.cnt ?? 0),
      };
    });
    list.sort((a, b) => b.revenue - a.revenue);
    ok(res, { days: f.days, totalRevenue, totalOrders: list.reduce((a, x) => a + x.orders, 0), categories: list });
  }),
);

r.get(
  '/categories/:slug',
  authenticate,
  validate({ query: catQ }),
  ah(async (req, res) => {
    const f = q(req, catQ);
    const sid = scope(req);
    const cat = await prisma.category.findUnique({ where: { slug: req.params.slug }, include: { children: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true } } } });
    if (!cat) throw Errors.notFound('Kategoriya');
    const ids = [cat.id, ...cat.children.map((c) => c.id)];
    const since = new Date(Date.now() - f.days * 86400_000);
    const base = Prisma.sql`FROM "OrderItem" oi
        JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE p."categoryId" IN (${Prisma.join(ids)}) AND so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since} ${sellerFilter(sid)}`;
    const [daily, subs, top, sellersTop, regions, statuses, prices] = await Promise.all([
      prisma.$queryRaw<{ d: Date; revenue: Prisma.Decimal; orders: bigint; qty: Prisma.Decimal }[]>`
        SELECT date_trunc('day', so."createdAt" AT TIME ZONE 'Asia/Tashkent') AS d, SUM(oi."lineTotal") AS revenue, COUNT(DISTINCT so.id) AS orders, SUM(oi.quantity) AS qty ${base} GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ cid: string; revenue: Prisma.Decimal; orders: bigint }[]>`
        SELECT p."categoryId" AS cid, SUM(oi."lineTotal") AS revenue, COUNT(DISTINCT so.id) AS orders ${base} GROUP BY 1`,
      prisma.$queryRaw<{ id: string; name: string; revenue: Prisma.Decimal; qty: Prisma.Decimal; unit: string; orders: bigint }[]>`
        SELECT oi."productId" AS id, MAX(oi."productName") AS name, SUM(oi."lineTotal") AS revenue, SUM(oi.quantity) AS qty, MAX(oi.unit::text) AS unit, COUNT(DISTINCT so.id) AS orders
        ${base} GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
      sid
        ? Promise.resolve([] as { id: string; name: string; revenue: Prisma.Decimal; orders: bigint }[])
        : prisma.$queryRaw<{ id: string; name: string; revenue: Prisma.Decimal; orders: bigint }[]>`
        SELECT so."sellerId" AS id, MAX(sp."farmName") AS name, SUM(oi."lineTotal") AS revenue, COUNT(DISTINCT so.id) AS orders
        FROM "OrderItem" oi
        JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
        JOIN "SellerProfile" sp ON sp.id = so."sellerId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE p."categoryId" IN (${Prisma.join(ids)}) AND so.status NOT IN ('cancelled','refunded') AND so."createdAt" >= ${since}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
      prisma.$queryRaw<{ region: string; revenue: Prisma.Decimal; orders: bigint }[]>`
        SELECT o.region, SUM(oi."lineTotal") AS revenue, COUNT(DISTINCT so.id) AS orders ${base} GROUP BY 1 ORDER BY revenue DESC`,
      prisma.$queryRaw<{ status: string; n: bigint }[]>`
        SELECT so.status::text AS status, COUNT(DISTINCT so.id) AS n
        FROM "OrderItem" oi JOIN "SellerOrder" so ON so.id = oi."sellerOrderId" JOIN "Product" p ON p.id = oi."productId"
        WHERE p."categoryId" IN (${Prisma.join(ids)}) AND so."createdAt" >= ${since} ${sellerFilter(sid)} GROUP BY 1`,
      prisma.$queryRaw<{ min: Prisma.Decimal | null; max: Prisma.Decimal | null; avg: Prisma.Decimal | null }[]>`
        SELECT MIN(oi."unitPrice") AS min, MAX(oi."unitPrice") AS max, AVG(oi."unitPrice") AS avg ${base}`,
    ]);
    const subBy = new Map(subs.map((x) => [x.cid, x]));
    const revenue = daily.reduce((a, x) => a + Number(x.revenue), 0);
    const orders = daily.reduce((a, x) => a + Number(x.orders), 0);
    ok(res, {
      category: { id: cat.id, slug: cat.slug, nameUz: cat.nameUz, nameRu: cat.nameRu, nameEn: cat.nameEn, icon: cat.icon, imageUrl: cat.imageUrl },
      days: f.days,
      summary: { revenue, orders, averageOrder: orders ? Math.round(revenue / orders) : 0, minPrice: Number(prices[0]?.min ?? 0), maxPrice: Number(prices[0]?.max ?? 0), avgPrice: Math.round(Number(prices[0]?.avg ?? 0)) },
      series: daily.map((x) => ({ date: x.d.toISOString().slice(0, 10), revenue: Number(x.revenue), orders: Number(x.orders), quantity: Number(x.qty) })),
      subcategories: [{ id: cat.id, slug: cat.slug, nameUz: cat.nameUz, nameRu: cat.nameRu, nameEn: cat.nameEn }, ...cat.children]
        .map((c) => ({ ...c, revenue: Number(subBy.get(c.id)?.revenue ?? 0), orders: Number(subBy.get(c.id)?.orders ?? 0) }))
        .filter((c) => c.revenue > 0 || c.id !== cat.id),
      topProducts: top.map((x) => ({ id: x.id, name: x.name, revenue: Number(x.revenue), quantity: Number(x.qty), unit: x.unit, orders: Number(x.orders) })),
      topSellers: sellersTop.map((x) => ({ id: x.id, name: x.name, revenue: Number(x.revenue), orders: Number(x.orders) })),
      regions: regions.map((x) => ({ region: x.region, revenue: Number(x.revenue), orders: Number(x.orders) })),
      statuses: Object.fromEntries(statuses.map((x) => [x.status, Number(x.n)])),
    });
  }),
);

export default r;
