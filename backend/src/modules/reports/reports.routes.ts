import { Router, type Request } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, validate, q } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { audit } from '../../common/audit';

/**
 * Hisobot konstruktori. Admin — butun platforma, fermer — faqat o'z xo'jaligi.
 * Barcha hisobotlar ekranda ko'rinadi va CSV (Excel ochadi, UTF-8) ko'rinishida yuklab olinadi; PDF — brauzerda chop etish orqali.
 */
const r = Router();
r.use(authenticate);

const baseQ = z.object({
  days: z.coerce.number().int().min(1).max(730).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  categories: z.string().max(2000).optional(),
  status: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(1000),
});
type BaseQ = z.infer<typeof baseQ>;

function scope(req: Request) {
  if (req.user!.role === 'ADMIN') return null;
  if (req.user!.role === 'SELLER' && req.user!.sellerId) return req.user!.sellerId;
  throw Errors.forbidden();
}

function range(f: BaseQ) {
  const to = f.to ? new Date(`${f.to}T23:59:59.999+05:00`) : new Date();
  const from = f.from ? new Date(`${f.from}T00:00:00+05:00`) : new Date(to.getTime() - (f.days ?? 30) * 86400_000);
  return { from, to };
}

async function categoryIds(slugs?: string) {
  if (!slugs) return null;
  const list = slugs.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return null;
  const cats = await prisma.category.findMany({ where: { slug: { in: list } }, select: { id: true, children: { select: { id: true } } } });
  return cats.flatMap((c) => [c.id, ...c.children.map((x) => x.id)]);
}

type LineRow = { at: Date; number: string; order_id: string; product: string; category: string; farm: string; region: string; district: string; qty: Prisma.Decimal; unit: string; price: Prisma.Decimal; total: Prisma.Decimal; status: string; method: string };

async function lines(req: Request, f: BaseQ) {
  const sid = scope(req);
  const { from, to } = range(f);
  const ids = await categoryIds(f.categories);
  const rows = await prisma.$queryRaw<LineRow[]>`
    SELECT so."createdAt" AS at, so.number, o.id AS order_id, oi."productName" AS product, c."nameUz" AS category, sp."farmName" AS farm, o.region, o.district,
           oi.quantity AS qty, oi.unit::text AS unit, oi."unitPrice" AS price, oi."lineTotal" AS total, so.status::text AS status, o."paymentMethod"::text AS method
    FROM "OrderItem" oi
    JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
    JOIN "SellerProfile" sp ON sp.id = so."sellerId"
    JOIN "Order" o ON o.id = oi."orderId"
    LEFT JOIN "Product" p ON p.id = oi."productId"
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE so."createdAt" BETWEEN ${from} AND ${to}
      ${f.status ? Prisma.sql`AND so.status::text = ${f.status}` : Prisma.sql`AND so.status NOT IN ('cancelled','refunded')`}
      ${sid ? Prisma.sql`AND so."sellerId" = ${sid}` : Prisma.empty}
      ${ids ? Prisma.sql`AND p."categoryId" IN (${Prisma.join(ids)})` : Prisma.empty}
    ORDER BY so."createdAt" DESC
    LIMIT ${f.limit}`;
  const list = rows.map((x) => ({ date: x.at.toISOString(), number: x.number, orderId: x.order_id, product: x.product, category: x.category, farm: x.farm, region: x.region, district: x.district, quantity: Number(x.qty), unit: x.unit, price: Number(x.price), total: Number(x.total), status: x.status, method: x.method }));
  return { from, to, rows: list, totals: { revenue: list.reduce((a, x) => a + x.total, 0), quantity: list.reduce((a, x) => a + x.quantity, 0), lines: list.length, orders: new Set(list.map((x) => x.number)).size } };
}

async function orders(req: Request, f: BaseQ) {
  const sid = scope(req);
  const { from, to } = range(f);
  const ids = await categoryIds(f.categories);
  const where: Prisma.SellerOrderWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(sid ? { sellerId: sid } : {}),
    ...(f.status ? { status: f.status as never } : {}),
    ...(ids ? { items: { some: { product: { categoryId: { in: ids } } } } } : {}),
  };
  const rows = await prisma.sellerOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: f.limit,
    select: {
      id: true, number: true, status: true, subtotal: true, deliveryFee: true, discount: true, total: true, commissionAmount: true, sellerPayout: true, createdAt: true,
      seller: { select: { farmName: true } },
      order: { select: { id: true, recipientName: true, region: true, district: true, paymentMethod: true, paymentStatus: true } },
      _count: { select: { items: true } },
    },
  });
  const list = rows.map((x) => ({ id: x.id, orderId: x.order.id, number: x.number, date: x.createdAt.toISOString(), farm: x.seller.farmName, buyer: x.order.recipientName, region: x.order.region, district: x.order.district, items: x._count.items, subtotal: Number(x.subtotal), deliveryFee: Number(x.deliveryFee), discount: Number(x.discount), total: Number(x.total), commission: Number(x.commissionAmount), payout: Number(x.sellerPayout), status: x.status, method: x.order.paymentMethod, paymentStatus: x.order.paymentStatus }));
  const live = list.filter((x) => !['cancelled', 'refunded'].includes(x.status));
  const byStatus: Record<string, number> = {};
  for (const x of list) byStatus[x.status] = (byStatus[x.status] ?? 0) + 1;
  return { from, to, rows: list, totals: { orders: list.length, revenue: live.reduce((a, x) => a + x.total, 0), commission: live.reduce((a, x) => a + x.commission, 0), average: live.length ? Math.round(live.reduce((a, x) => a + x.total, 0) / live.length) : 0, byStatus } };
}

async function products(req: Request, f: BaseQ) {
  const sid = scope(req);
  const ids = await categoryIds(f.categories);
  const { from, to } = range(f);
  const rows = await prisma.product.findMany({
    where: { deletedAt: null, ...(sid ? { sellerId: sid } : {}), ...(ids ? { categoryId: { in: ids } } : {}), ...(f.status ? { status: f.status as never } : { status: 'active' }) },
    orderBy: { createdAt: 'desc' },
    take: f.limit,
    select: { id: true, name: true, slug: true, price: true, discountPrice: true, unit: true, status: true, ratingAvg: true, ratingCount: true, createdAt: true, region: true, category: { select: { nameUz: true } }, seller: { select: { farmName: true } }, inventory: { select: { quantity: true } } },
  });
  const sold = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: { productId: { in: rows.map((x) => x.id) }, sellerOrder: { createdAt: { gte: from, lte: to }, status: { notIn: ['cancelled', 'refunded'] } } },
    _sum: { quantity: true, lineTotal: true },
  });
  const sm = new Map(sold.map((s) => [s.productId, s._sum]));
  const list = rows.map((x) => ({ id: x.id, slug: x.slug, name: x.name, category: x.category.nameUz, farm: x.seller.farmName, region: x.region, price: Number(x.discountPrice ?? x.price), unit: x.unit, stock: Number(x.inventory?.quantity ?? 0), sold: Number(sm.get(x.id)?.quantity ?? 0), revenue: Number(sm.get(x.id)?.lineTotal ?? 0), rating: Number(x.ratingAvg), reviews: x.ratingCount, status: x.status, created: x.createdAt.toISOString() }));
  return { from, to, rows: list, totals: { products: list.length, stockValue: list.reduce((a, x) => a + x.stock * x.price, 0), revenue: list.reduce((a, x) => a + x.revenue, 0) } };
}

async function categories(req: Request, f: BaseQ) {
  const sid = scope(req);
  const { from, to } = range(f);
  const ids = await categoryIds(f.categories);
  type R = { id: string; name: string; slug: string; revenue: Prisma.Decimal | null; orders: bigint; qty: Prisma.Decimal | null; min: Prisma.Decimal | null; max: Prisma.Decimal | null; avg: Prisma.Decimal | null };
  const rows = await prisma.$queryRaw<R[]>`
    WITH sales AS (
      SELECT COALESCE(c."parentId", c.id) AS root, oi."lineTotal", oi.quantity, oi."unitPrice", so.id AS so_id
      FROM "OrderItem" oi
      JOIN "SellerOrder" so ON so.id = oi."sellerOrderId"
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      WHERE so."createdAt" BETWEEN ${from} AND ${to} AND so.status NOT IN ('cancelled','refunded') ${sid ? Prisma.sql`AND so."sellerId" = ${sid}` : Prisma.empty}
    )
    SELECT root.id, root."nameUz" AS name, root.slug,
           SUM(s."lineTotal") AS revenue, COUNT(DISTINCT s.so_id) AS orders, SUM(s.quantity) AS qty,
           MIN(s."unitPrice") AS min, MAX(s."unitPrice") AS max, AVG(s."unitPrice") AS avg
    FROM "Category" root
    LEFT JOIN sales s ON s.root = root.id
    WHERE root."parentId" IS NULL AND root."isActive" = true ${ids ? Prisma.sql`AND root.id IN (${Prisma.join(ids)})` : Prisma.empty}
    GROUP BY root.id, root."nameUz", root.slug, root."sortOrder"
    ORDER BY revenue DESC NULLS LAST, root."sortOrder"`;
  const active = await prisma.product.groupBy({ by: ['categoryId'], where: { status: 'active', deletedAt: null, ...(sid ? { sellerId: sid } : {}) }, _count: { _all: true } });
  const cats = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const rootOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
  const act = new Map<string, number>();
  for (const a of active) {
    const root = rootOf.get(a.categoryId) ?? a.categoryId;
    act.set(root, (act.get(root) ?? 0) + a._count._all);
  }
  const total = rows.reduce((a, x) => a + Number(x.revenue ?? 0), 0);
  const list = rows.map((x) => ({ id: x.id, slug: x.slug, name: x.name, revenue: Number(x.revenue ?? 0), orders: Number(x.orders), quantity: Number(x.qty ?? 0), activeProducts: act.get(x.id) ?? 0, minPrice: Number(x.min ?? 0), maxPrice: Number(x.max ?? 0), avgPrice: Math.round(Number(x.avg ?? 0)), share: total ? Math.round((Number(x.revenue ?? 0) / total) * 1000) / 10 : 0 }));
  return { from, to, rows: list, totals: { revenue: total, orders: list.reduce((a, x) => a + x.orders, 0), categories: list.length, activeProducts: list.reduce((a, x) => a + x.activeProducts, 0) } };
}

const BUILDERS = { lines, orders, products, categories };
type Kind = keyof typeof BUILDERS;

r.get(
  '/:kind',
  validate({ query: baseQ }),
  ah(async (req, res) => {
    const kind = req.params.kind as Kind;
    if (!BUILDERS[kind]) throw Errors.notFound('Hisobot');
    ok(res, await BUILDERS[kind](req, q(req, baseQ)));
  }),
);

// ───────── CSV eksport ─────────
const COLUMNS: Record<Kind, [string, string][]> = {
  lines: [['date', 'Sana'], ['number', 'Buyurtma'], ['product', 'Mahsulot'], ['category', 'Kategoriya'], ['farm', "Fermer xo'jaligi"], ['region', 'Viloyat'], ['quantity', 'Miqdor'], ['unit', "O'lchov"], ['price', 'Narx'], ['total', 'Summa'], ['status', 'Holat'], ['method', "To'lov"]],
  orders: [['date', 'Sana'], ['number', 'Buyurtma'], ['farm', "Fermer xo'jaligi"], ['buyer', 'Xaridor'], ['region', 'Viloyat'], ['items', 'Pozitsiyalar'], ['subtotal', 'Mahsulotlar'], ['deliveryFee', 'Yetkazish'], ['discount', 'Chegirma'], ['total', 'Jami'], ['commission', 'Komissiya'], ['payout', 'Fermerga'], ['status', 'Holat'], ['method', "To'lov"], ['paymentStatus', "To'lov holati"]],
  products: [['name', 'Mahsulot'], ['category', 'Kategoriya'], ['farm', "Fermer xo'jaligi"], ['region', 'Viloyat'], ['price', 'Narx'], ['unit', "O'lchov"], ['stock', 'Qoldiq'], ['sold', 'Sotilgan'], ['revenue', 'Tushum'], ['rating', 'Reyting'], ['status', 'Holat']],
  categories: [['name', 'Kategoriya'], ['revenue', 'Tushum'], ['share', 'Ulush %'], ['orders', 'Buyurtmalar'], ['quantity', 'Miqdor'], ['activeProducts', 'Faol mahsulotlar'], ['minPrice', 'Min narx'], ['avgPrice', "O'rtacha narx"], ['maxPrice', 'Max narx']],
};

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`; // formula injection himoyasi
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

r.get(
  '/:kind/export',
  validate({ query: baseQ }),
  ah(async (req, res) => {
    const kind = req.params.kind as Kind;
    if (!BUILDERS[kind]) throw Errors.notFound('Hisobot');
    const f = q(req, baseQ);
    const data = await BUILDERS[kind](req, { ...f, limit: 5000 });
    const cols = COLUMNS[kind];
    const fmt = (k: string, v: unknown) => (k === 'date' && typeof v === 'string' ? new Date(v).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : v);
    const out = [cols.map((c) => cell(c[1])).join(';'), ...data.rows.map((row) => cols.map(([k]) => cell(fmt(k, (row as Record<string, unknown>)[k]))).join(';'))];
    const name = `agromarket-${kind}-${data.from.toISOString().slice(0, 10)}_${data.to.toISOString().slice(0, 10)}.csv`;
    await audit(req, 'report.export', 'Report', kind, { rows: data.rows.length });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(`\uFEFF${out.join('\r\n')}`);
  }),
);

export default r;
