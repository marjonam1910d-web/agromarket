import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate, q, pageParams, pageMeta } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma, type Tx } from '../../lib/prisma';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { storage } from '../../lib/storage';
import { getSetting } from '../../common/audit';
import { D } from '../../common/money';
import { notify } from '../notifications/notifications.service';

const r = Router();

/** O'rtacha reytingni qayta hisoblash (faqat ko'rinadigan sharhlar) */
export async function recomputeRatings(tx: Tx, productId: string, sellerProfileId: string) {
  const [p, s] = await Promise.all([
    tx.review.aggregate({ where: { productId, status: 'published' }, _avg: { rating: true }, _count: { _all: true } }),
    tx.review.aggregate({ where: { sellerId: sellerProfileId, status: 'published' }, _avg: { sellerRating: true, rating: true }, _count: { _all: true } }),
  ]);
  await tx.product.update({ where: { id: productId }, data: { ratingAvg: D((p._avg.rating ?? 0).toFixed(2)), ratingCount: p._count._all } });
  const sellerAvg = s._avg.sellerRating ?? s._avg.rating ?? 0;
  await tx.sellerProfile.update({ where: { id: sellerProfileId }, data: { ratingAvg: D(sellerAvg.toFixed(2)), ratingCount: s._count._all } });
}

const listQ = z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().optional(), rating: z.coerce.number().int().min(1).max(5).optional() });

/** Ommaviy: mahsulot sharhlari + reyting taqsimoti */
r.get(
  '/product/:productId',
  validate({ query: listQ }),
  ah(async (req, res) => {
    const f = q(req, listQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 10);
    const where = { productId: req.params.productId, status: 'published' as const, ...(f.rating ? { rating: f.rating } : {}) };
    const [rows, total, dist] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: { id: true, rating: true, text: true, images: true, sellerReply: true, createdAt: true, buyer: { select: { fullName: true, avatarUrl: true } } },
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ['rating'], where: { productId: req.params.productId, status: 'published' }, _count: { _all: true } }),
    ]);
    // Shaxsiy ma'lumotni kamaytirish: faqat ism va familiyaning bosh harfi
    const masked = rows.map((x) => ({
      ...x,
      verifiedPurchase: true,
      buyer: { name: x.buyer.fullName.split(' ').map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(' '), avatarUrl: x.buyer.avatarUrl },
    }));
    ok(res, masked, { ...pageMeta(total, page, limit), distribution: Object.fromEntries(dist.map((d) => [d.rating, d._count._all])) });
  }),
);

/** Ommaviy: landing uchun so'nggi haqiqiy sharhlar (matnli, 4–5 yulduz) */
r.get(
  '/latest',
  ah(async (_req, res) => {
    const rows = await prisma.review.findMany({
      where: { status: 'published', rating: { gte: 4 }, text: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, rating: true, text: true, createdAt: true,
        buyer: { select: { fullName: true } },
        product: { select: { name: true, slug: true } },
        seller: { select: { farmName: true } },
      },
    });
    ok(res, rows.map((x) => ({ ...x, buyer: { name: x.buyer.fullName.split(' ').map((w, i) => (i === 0 ? w : `${w[0]}.`)).join(' ') } })));
  }),
);

/** Xaridorning sharh qoldirish mumkin bo'lgan (yetkazilgan, sharhsiz) mahsulotlari */
r.get(
  '/eligible',
  authenticate,
  ah(async (req, res) => {
    const items = await prisma.orderItem.findMany({
      where: { order: { buyerId: req.user!.id }, sellerOrder: { status: 'delivered' }, review: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, productId: true, productName: true, imageUrl: true, createdAt: true, order: { select: { id: true, orderNumber: true } } },
    });
    ok(res, items);
  }),
);

r.get(
  '/mine',
  authenticate,
  ah(async (req, res) => {
    ok(res, await prisma.review.findMany({ where: { buyerId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { product: { select: { name: true, slug: true } } } }));
  }),
);

const createSchema = z.object({
  orderItemId: z.string(),
  rating: z.number().int().min(1).max(5),
  sellerRating: z.number().int().min(1).max(5).optional(),
  text: z.string().trim().max(2000).optional(),
  images: z.array(z.string().url()).max(5).default([]),
});

/** Faqat yetkazilgan buyurtma qatori uchun, bir marta (orderItemId UNIQUE) */
r.post(
  '/',
  authenticate,
  validate({ body: createSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    if (b.images.some((u) => !storage.isOwnPublicUrl(u))) throw Errors.badRequest('Rasmlar faqat platforma orqali yuklanadi');
    const item = await prisma.orderItem.findFirst({
      where: { id: b.orderItemId, order: { buyerId: req.user!.id } },
      include: { sellerOrder: { select: { status: true, sellerId: true, seller: { select: { userId: true } } } }, review: true },
    });
    if (!item) throw Errors.notFound('Buyurtma qatori');
    if (item.sellerOrder.status !== 'delivered') throw new AppError(403, 'NOT_ELIGIBLE', 'Sharhni faqat yetkazilgan buyurtma uchun qoldirish mumkin');
    if (item.review) throw Errors.conflict('ALREADY_REVIEWED', 'Bu mahsulotga allaqachon sharh qoldirgansiz');
    const review = await prisma.$transaction(async (tx) => {
      const rv = await tx.review.create({
        data: {
          orderItemId: item.id,
          productId: item.productId,
          sellerId: item.sellerOrder.sellerId,
          buyerId: req.user!.id,
          rating: b.rating,
          sellerRating: b.sellerRating ?? b.rating,
          text: b.text || null,
          images: b.images,
        },
      });
      await recomputeRatings(tx, item.productId, item.sellerOrder.sellerId);
      return rv;
    });
    void notify({
      userId: item.sellerOrder.seller.userId,
      type: 'review.new',
      key: 'review.new',
      params: { name: item.productName, rating: b.rating },
      link: '/seller/reviews',
    });
    created(res, review);
  }),
);

/** Sharh ustidan shikoyat — limitdan oshsa avtomatik yashiriladi (admin ko'rib chiqadi) */
r.post(
  '/:id/report',
  authenticate,
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const rv = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!rv) throw Errors.notFound('Sharh');
    const limit = Number(await getSetting('reviews.autoHideReports'));
    await prisma.$transaction(async (tx) => {
      await tx.reviewReport.create({ data: { reviewId: rv.id, userId: req.user!.id, reason: req.body.reason } });
      const u = await tx.review.update({ where: { id: rv.id }, data: { reportCount: { increment: 1 } } });
      if (u.reportCount >= limit && u.status === 'published') {
        await tx.review.update({ where: { id: rv.id }, data: { status: 'hidden' } });
        await recomputeRatings(tx, rv.productId, rv.sellerId);
      }
    });
    ok(res, { reported: true });
  }),
);

// ───────── Sotuvchi ─────────
r.get(
  '/seller',
  authenticate,
  requireSeller,
  validate({ query: listQ }),
  ah(async (req, res) => {
    const f = q(req, listQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 20);
    const where = { sellerId: sellerId(req), ...(f.rating ? { rating: f.rating } : {}) };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { product: { select: { name: true, slug: true } }, buyer: { select: { fullName: true } } },
      }),
      prisma.review.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.post(
  '/:id/reply',
  authenticate,
  requireSeller,
  validate({ body: z.object({ reply: z.string().trim().min(2).max(1000) }) }),
  ah(async (req, res) => {
    const x = await prisma.review.updateMany({ where: { id: req.params.id, sellerId: sellerId(req) }, data: { sellerReply: req.body.reply } });
    if (!x.count) throw Errors.notFound('Sharh');
    ok(res, { ok: true });
  }),
);

export default r;
