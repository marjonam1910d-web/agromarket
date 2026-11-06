import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q, pageParams, pageMeta } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { storage } from '../../lib/storage';
import { D } from '../../common/money';
import { notifyAdmins } from '../notifications/notifications.service';
import { productCardSelect, toCard } from '../products/products.service';

const r = Router();

// ───────── Ommaviy: tasdiqlangan fermerlar katalogi ─────────
const listQ = z.object({
  q: z.string().max(80).optional(),
  region: z.string().max(40).optional(),
  sort: z.enum(['rating', 'newest', 'products']).default('rating'),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

r.get(
  '/',
  validate({ query: listQ }),
  ah(async (req, res) => {
    const f = q(req, listQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 12);
    const where: Prisma.SellerProfileWhereInput = {
      verificationStatus: 'APPROVED',
      user: { status: 'ACTIVE' },
      ...(f.region ? { region: f.region } : {}),
      ...(f.q ? { OR: [{ farmName: { contains: f.q, mode: 'insensitive' } }, { description: { contains: f.q, mode: 'insensitive' } }] } : {}),
    };
    const orderBy: Prisma.SellerProfileOrderByWithRelationInput =
      f.sort === 'newest' ? { createdAt: 'desc' } : f.sort === 'products' ? { products: { _count: 'desc' } } : { ratingAvg: 'desc' };
    const [rows, total] = await Promise.all([
      prisma.sellerProfile.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip,
        take,
        select: {
          id: true, farmName: true, slug: true, description: true, region: true, district: true, logoUrl: true, coverUrl: true,
          ratingAvg: true, ratingCount: true, createdAt: true,
          _count: { select: { products: { where: { status: 'active', deletedAt: null } } } },
        },
      }),
      prisma.sellerProfile.count({ where }),
    ]);
    ok(res, rows.map(({ _count, ...s }) => ({ ...s, productCount: _count.products })), pageMeta(total, page, limit));
  }),
);

// ───────── Sotuvchining o'zi ─────────
r.get(
  '/me',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const s = await prisma.sellerProfile.findUniqueOrThrow({
      where: { id: sellerId(req) },
      include: { verifications: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, documentType: true, status: true, note: true, createdAt: true, reviewedAt: true, documentPath: true } } },
    });
    ok(res, {
      ...s,
      verifications: s.verifications.map((v) => ({ ...v, documentUrl: `/api/v1/uploads/private?key=${encodeURIComponent(v.documentPath)}`, documentPath: undefined })),
    });
  }),
);

const profileSchema = z
  .object({
    farmName: z.string().trim().min(2).max(120),
    description: z.string().max(3000).nullable().optional(),
    region: z.string(),
    district: z.string(),
    address: z.string().trim().min(3).max(250),
    tin: z.string().regex(/^\d{9}$|^\d{14}$/).nullable().optional().or(z.literal('')),
    logoUrl: z.string().url().nullable().optional(),
    coverUrl: z.string().url().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!isValidRegion(v.region)) ctx.addIssue({ code: 'custom', path: ['region'], message: "Viloyat noto'g'ri" });
    else if (!isValidDistrict(v.region, v.district)) ctx.addIssue({ code: 'custom', path: ['district'], message: "Tuman noto'g'ri" });
    for (const k of ['logoUrl', 'coverUrl'] as const) {
      const u = v[k];
      if (u && !storage.isOwnPublicUrl(u)) ctx.addIssue({ code: 'custom', path: [k], message: 'Rasm faqat platforma orqali yuklanadi' });
    }
  });

r.put(
  '/me',
  authenticate,
  requireSeller,
  validate({ body: profileSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof profileSchema>;
    const current = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId(req) } });
    // Tasdiqlangan sotuvchi STIRni o'zgartirsa — qayta tekshiruv talab qilinadi
    const tinChanged = (b.tin || null) !== current.tin && current.verificationStatus === 'APPROVED';
    const s = await prisma.sellerProfile.update({
      where: { id: current.id },
      data: { ...b, tin: b.tin || null, ...(tinChanged ? { verificationStatus: 'PENDING' } : {}) },
    });
    ok(res, { ...s, reverificationRequired: tinChanged });
  }),
);

r.post(
  '/me/verification',
  authenticate,
  requireSeller,
  validate({ body: z.object({ documentKey: z.string().startsWith('private/docs/'), documentType: z.enum(['certificate', 'license', 'passport', 'farm_registry', 'other']) }) }),
  ah(async (req, res) => {
    // Hujjat shu foydalanuvchiniki ekanini kalit orqali tekshiramiz
    if (req.body.documentKey.split('/')[2] !== req.user!.id) throw Errors.forbidden();
    const s = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId(req) } });
    if (s.verificationStatus === 'APPROVED') throw new AppError(409, 'ALREADY_VERIFIED', "Xo'jalik allaqachon tasdiqlangan");
    const v = await prisma.$transaction(async (tx) => {
      const created = await tx.sellerVerification.create({ data: { sellerId: s.id, documentType: req.body.documentType, documentPath: req.body.documentKey } });
      await tx.sellerProfile.update({ where: { id: s.id }, data: { verificationStatus: 'PENDING' } });
      return created;
    });
    await notifyAdmins({ type: 'seller.verification', key: 'seller.verification.submitted', params: { farm: s.farmName }, link: '/admin/sellers' });
    created(res, { id: v.id, status: v.status });
  }),
);

// ───────── Aksiyalar (promotions) ─────────
const promoSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().max(500).nullable().optional(),
    discountPercent: z.number().int().min(1).max(90),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isActive: z.boolean().default(true),
    productIds: z.array(z.string()).min(1).max(100),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ['endsAt'], message: "Tugash sanasi boshlanishdan keyin bo'lsin" });

r.get(
  '/me/promotions',
  authenticate,
  requireSeller,
  ah(async (req, res) => ok(res, await prisma.promotion.findMany({ where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'desc' }, include: { products: { select: { id: true, name: true } } } }))),
);

async function assertOwnProducts(sid: string, ids: string[]) {
  const n = await prisma.product.count({ where: { id: { in: ids }, sellerId: sid, deletedAt: null } });
  if (n !== new Set(ids).size) throw Errors.badRequest("Faqat o'z mahsulotlaringizni tanlang");
}

r.post(
  '/me/promotions',
  authenticate,
  requireSeller,
  validate({ body: promoSchema }),
  ah(async (req, res) => {
    const { productIds, ...b } = req.body as z.infer<typeof promoSchema>;
    await assertOwnProducts(sellerId(req), productIds);
    created(res, await prisma.promotion.create({ data: { ...b, sellerId: sellerId(req), products: { connect: productIds.map((id) => ({ id })) } } }));
  }),
);

r.put(
  '/me/promotions/:id',
  authenticate,
  requireSeller,
  validate({ body: promoSchema }),
  ah(async (req, res) => {
    const { productIds, ...b } = req.body as z.infer<typeof promoSchema>;
    const p = await prisma.promotion.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!p) throw Errors.notFound('Aksiya');
    await assertOwnProducts(sellerId(req), productIds);
    ok(res, await prisma.promotion.update({ where: { id: p.id }, data: { ...b, products: { set: productIds.map((id) => ({ id })) } } }));
  }),
);

r.delete(
  '/me/promotions/:id',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const x = await prisma.promotion.deleteMany({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!x.count) throw Errors.notFound('Aksiya');
    ok(res, { deleted: true });
  }),
);

// ───────── Kuponlar ─────────
const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Kod: lotin harflari va raqamlar (3–30)'),
    type: z.enum(['percent', 'fixed']),
    value: z.coerce.number().positive(),
    minOrderAmount: z.coerce.number().min(0).default(0),
    maxDiscount: z.coerce.number().positive().nullable().optional(),
    usageLimit: z.coerce.number().int().positive().nullable().optional(),
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.type !== 'percent' || v.value <= 90, { path: ['value'], message: 'Foiz 90 dan oshmasin' })
  .refine((v) => v.endsAt > v.startsAt, { path: ['endsAt'], message: "Tugash sanasi boshlanishdan keyin bo'lsin" });

export const couponData = (b: z.infer<typeof couponSchema>) => ({
  ...b,
  value: D(b.value),
  minOrderAmount: D(b.minOrderAmount),
  maxDiscount: b.maxDiscount ? D(b.maxDiscount) : null,
  usageLimit: b.usageLimit ?? null,
});
export { couponSchema };

r.get('/me/coupons', authenticate, requireSeller, ah(async (req, res) => ok(res, await prisma.coupon.findMany({ where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'desc' } }))));

r.post(
  '/me/coupons',
  authenticate,
  requireSeller,
  validate({ body: couponSchema }),
  ah(async (req, res) => created(res, await prisma.coupon.create({ data: { ...couponData(req.body), sellerId: sellerId(req) } }))),
);

r.patch(
  '/me/coupons/:id',
  authenticate,
  requireSeller,
  validate({ body: z.object({ isActive: z.boolean() }) }),
  ah(async (req, res) => {
    const x = await prisma.coupon.updateMany({ where: { id: req.params.id, sellerId: sellerId(req) }, data: { isActive: req.body.isActive } });
    if (!x.count) throw Errors.notFound('Kupon');
    ok(res, { ok: true });
  }),
);

// ───────── Daromad ─────────
r.get(
  '/me/earnings',
  authenticate,
  requireSeller,
  validate({ query: z.object({ page: z.coerce.number().optional() }) }),
  ah(async (req, res) => {
    const sid = sellerId(req);
    const { skip, take, page, limit } = pageParams((q(req) as { page?: number }).page, 20);
    const where: Prisma.SellerOrderWhereInput = { sellerId: sid, status: 'delivered' };
    const [rows, total, agg, pending] = await Promise.all([
      prisma.sellerOrder.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: { id: true, number: true, total: true, commissionAmount: true, sellerPayout: true, updatedAt: true, order: { select: { paymentMethod: true } } },
      }),
      prisma.sellerOrder.count({ where }),
      prisma.sellerOrder.aggregate({ where, _sum: { total: true, commissionAmount: true, sellerPayout: true } }),
      prisma.sellerOrder.aggregate({
        where: { sellerId: sid, status: { in: ['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped'] } },
        _sum: { sellerPayout: true },
      }),
    ]);
    ok(res, {
      summary: {
        gross: agg._sum.total ?? 0,
        commission: agg._sum.commissionAmount ?? 0,
        net: agg._sum.sellerPayout ?? 0,
        pendingNet: pending._sum.sellerPayout ?? 0,
      },
      items: rows,
    }, pageMeta(total, page, limit));
  }),
);

// ───────── Ommaviy: fermer sahifasi (slug bo'yicha) — oxirida, /me bilan to'qnashmasligi uchun ─────────
r.get(
  '/:slug',
  ah(async (req, res) => {
    const now = new Date();
    const s = await prisma.sellerProfile.findFirst({
      where: { slug: req.params.slug, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } },
      select: {
        id: true, userId: true, farmName: true, slug: true, description: true, region: true, district: true, logoUrl: true, coverUrl: true,
        ratingAvg: true, ratingCount: true, createdAt: true,
        deliveryZones: { where: { isActive: true }, select: { region: true, district: true, baseFee: true, freeFromAmount: true, minDays: true, maxDays: true } },
      },
    });
    if (!s) throw Errors.notFound('Fermer');
    const [products, reviews, delivered] = await Promise.all([
      prisma.product.findMany({ where: { sellerId: s.id, status: { in: ['active', 'out_of_stock'] }, deletedAt: null }, orderBy: { soldCount: 'desc' }, take: 24, select: productCardSelect(now) }),
      prisma.review.findMany({
        where: { sellerId: s.id, status: 'published' },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, rating: true, text: true, createdAt: true, product: { select: { name: true } }, buyer: { select: { fullName: true } } },
      }),
      prisma.sellerOrder.count({ where: { sellerId: s.id, status: 'delivered' } }),
    ]);
    ok(res, {
      ...s,
      products: products.map((p) => toCard(p, now)),
      reviews: reviews.map((x) => ({ ...x, buyer: { name: x.buyer.fullName.split(' ')[0] } })),
      stats: { deliveredOrders: delivered, productCount: products.length },
    });
  }),
);

export default r;
