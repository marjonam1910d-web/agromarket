import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q, pageParams, pageMeta } from '../../common/http';
import { Errors, AppError } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, optionalAuth, requireSeller, sellerId } from '../../middleware/auth';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { uniqueSlug } from '../../common/utils';
import { storage } from '../../lib/storage';
import { audit, getSetting } from '../../common/audit';
import { D } from '../../common/money';
import { notifyAdmins } from '../notifications/notifications.service';
import { productCardSelect, syncStockStatus, toCard } from './products.service';
import { activePromotionsInclude, DEFAULT_UNIT_WEIGHT, effectivePrice, finalUnitPrice } from './pricing';

const r = Router();

// ───────── Ommaviy katalog: server tomonda qidiruv, filtr, saralash, sahifalash ─────────
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(80).optional(),
  seller: z.string().max(120).optional(),
  region: z.string().max(40).optional(),
  district: z.string().max(60).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  seasonal: z.enum(['true', 'false']).optional(),
  organic: z.enum(['true', 'false']).optional(),
  discount: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'rating', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
});

r.get(
  '/',
  validate({ query: listQuery }),
  ah(async (req, res) => {
    const f = q(req, listQuery);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 24);
    const now = new Date();
    const and: Prisma.ProductWhereInput[] = [
      { deletedAt: null },
      { status: f.inStock === 'true' ? 'active' : { in: ['active', 'out_of_stock'] } },
      { seller: { verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } } },
    ];
    if (f.q) {
      and.push({
        OR: [
          { name: { contains: f.q, mode: 'insensitive' } },
          { description: { contains: f.q, mode: 'insensitive' } },
          { seller: { farmName: { contains: f.q, mode: 'insensitive' } } },
          { category: { OR: [{ nameUz: { contains: f.q, mode: 'insensitive' } }, { nameRu: { contains: f.q, mode: 'insensitive' } }, { nameEn: { contains: f.q, mode: 'insensitive' } }] } },
        ],
      });
    }
    if (f.category) {
      const cat = await prisma.category.findUnique({ where: { slug: f.category }, include: { children: { select: { id: true } } } });
      if (!cat) return ok(res, [], pageMeta(0, page, limit));
      and.push({ categoryId: { in: [cat.id, ...cat.children.map((c) => c.id)] } });
    }
    if (f.seller) and.push({ seller: { slug: f.seller } });
    if (f.region) and.push({ region: f.region });
    if (f.district) and.push({ district: f.district });
    if (f.minPrice !== undefined || f.maxPrice !== undefined) {
      and.push({ effectivePrice: { ...(f.minPrice !== undefined ? { gte: f.minPrice } : {}), ...(f.maxPrice !== undefined ? { lte: f.maxPrice } : {}) } });
    }
    if (f.minRating) and.push({ ratingAvg: { gte: f.minRating } });
    if (f.seasonal === 'true') and.push({ isSeasonal: true });
    if (f.organic === 'true') and.push({ isOrganic: true });
    if (f.discount === 'true') {
      and.push({ OR: [{ discountPrice: { not: null } }, { promotions: { some: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } } } }] });
    }
    const where: Prisma.ProductWhereInput = { AND: and };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = {
      newest: [{ createdAt: 'desc' as const }],
      price_asc: [{ effectivePrice: 'asc' as const }],
      price_desc: [{ effectivePrice: 'desc' as const }],
      rating: [{ ratingAvg: 'desc' as const }, { ratingCount: 'desc' as const }],
      popular: [{ soldCount: 'desc' as const }],
    }[f.sort];
    orderBy.push({ id: 'asc' });

    const [rows, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, skip, take, select: productCardSelect(now) }),
      prisma.product.count({ where }),
    ]);
    ok(res, rows.map((p) => toCard(p, now)), pageMeta(total, page, limit));
  }),
);

/** Sotuvchining o'z mahsulotlari (barcha holatlar) */
r.get(
  '/mine',
  authenticate,
  requireSeller,
  validate({ query: z.object({ status: z.string().optional(), q: z.string().optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { status?: string; q?: string; page?: number; limit?: number };
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 20);
    const where: Prisma.ProductWhereInput = {
      sellerId: sellerId(req),
      deletedAt: null,
      ...(f.status ? { status: f.status as Prisma.EnumProductStatusFilter['equals'] } : {}),
      ...(f.q ? { name: { contains: f.q, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        select: { ...productCardSelect(), rejectionReason: true, updatedAt: true, inventory: { select: { quantity: true, lowStockThreshold: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    ok(
      res,
      rows.map((p) => ({ ...toCard(p), rejectionReason: p.rejectionReason, updatedAt: p.updatedAt, lowStockThreshold: p.inventory?.lowStockThreshold })),
      pageMeta(total, page, limit),
    );
  }),
);

r.get(
  '/:slug',
  optionalAuth,
  ah(async (req, res) => {
    const now = new Date();
    const p = await prisma.product.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }], deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        inventory: { select: { quantity: true } },
        category: { include: { parent: true } },
        promotions: activePromotionsInclude(now),
        seller: {
          select: {
            id: true, userId: true, farmName: true, slug: true, region: true, district: true, logoUrl: true,
            verificationStatus: true, ratingAvg: true, ratingCount: true, description: true, createdAt: true,
            _count: { select: { products: { where: { status: 'active', deletedAt: null } } } },
          },
        },
      },
    });
    if (!p) throw Errors.notFound('Mahsulot');
    const isOwner = req.user?.sellerId === p.sellerId;
    const isAdmin = req.user?.role === 'ADMIN';
    const publicVisible = ['active', 'out_of_stock'].includes(p.status) && p.seller.verificationStatus === 'APPROVED';
    if (!publicVisible && !isOwner && !isAdmin) throw Errors.notFound('Mahsulot');

    const [favorite, related] = await Promise.all([
      req.user ? prisma.favorite.findUnique({ where: { userId_productId: { userId: req.user.id, productId: p.id } } }) : null,
      prisma.product.findMany({
        where: { categoryId: p.categoryId, id: { not: p.id }, status: 'active', deletedAt: null, seller: { verificationStatus: 'APPROVED' } },
        orderBy: { ratingAvg: 'desc' },
        take: 8,
        select: productCardSelect(now),
      }),
    ]);
    const finalPrice = finalUnitPrice(p, now);
    const { seller, promotions, ...rest } = p;
    const { userId: sellerUserId, ...sellerPublic } = seller;
    ok(res, {
      ...rest,
      seller: { ...sellerPublic, userId: sellerUserId },
      finalPrice,
      hasDiscount: finalPrice.lessThan(p.price),
      promotionPercent: promotions.reduce((m, x) => Math.max(m, x.discountPercent), 0),
      stock: p.inventory?.quantity ?? 0,
      isFavorite: Boolean(favorite),
      isOwner,
      related: related.map((x) => toCard(x, now)),
    });
  }),
);

// ───────── Sotuvchi CRUD ─────────
const imageSchema = z.object({ url: z.string().url(), thumbUrl: z.string().url().optional().nullable() });

const productBase = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10, "Tavsif kamida 10 belgi").max(5000),
  categoryId: z.string().min(1),
  price: z.coerce.number().positive().max(1_000_000_000),
  discountPrice: z.coerce.number().positive().max(1_000_000_000).nullable().optional(),
  unit: z.enum(['kg', 'g', 'tonna', 'dona', 'litr', 'qop']),
  stock: z.coerce.number().min(0).max(10_000_000),
  minOrderQty: z.coerce.number().positive().max(100_000).default(1),
  weightPerUnitKg: z.coerce.number().positive().max(100_000).optional(),
  lowStockThreshold: z.coerce.number().min(0).max(1_000_000).default(10),
  region: z.string(),
  district: z.string(),
  isSeasonal: z.boolean().default(false),
  seasonLabel: z.string().max(60).nullable().optional(),
  isOrganic: z.boolean().default(false),
  images: z.array(imageSchema).max(8).default([]),
  submit: z.boolean().default(true), // false => qoralama
});

const productSchema = productBase.superRefine((v, ctx) => {
  if (v.discountPrice && v.discountPrice >= v.price) ctx.addIssue({ code: 'custom', path: ['discountPrice'], message: "Chegirma narxi asosiy narxdan kichik bo'lishi kerak" });
  if (!isValidRegion(v.region)) ctx.addIssue({ code: 'custom', path: ['region'], message: "Viloyat noto'g'ri" });
  else if (!isValidDistrict(v.region, v.district)) ctx.addIssue({ code: 'custom', path: ['district'], message: "Tuman noto'g'ri" });
  if (v.images.some((i) => !storage.isOwnPublicUrl(i.url))) ctx.addIssue({ code: 'custom', path: ['images'], message: 'Rasmlar faqat platforma orqali yuklanadi' });
});

async function assertCategory(id: string) {
  const c = await prisma.category.findFirst({ where: { id, isActive: true } });
  if (!c) throw Errors.badRequest('Kategoriya topilmadi');
}

async function initialStatus(req: Express.Request & { user?: { sellerId?: string | null } }, submit: boolean) {
  if (!submit) return 'draft' as const;
  const seller = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: req.user!.sellerId! } });
  if (seller.verificationStatus !== 'APPROVED') {
    throw new AppError(403, 'SELLER_NOT_VERIFIED', "Mahsulotni e'lon qilish uchun xo'jaligingiz admin tomonidan tasdiqlanishi kerak. Hozircha qoralama sifatida saqlashingiz mumkin.");
  }
  return (await getSetting('products.autoApprove')) ? ('active' as const) : ('pending_review' as const);
}

r.post(
  '/',
  authenticate,
  requireSeller,
  validate({ body: productSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof productSchema>;
    await assertCategory(b.categoryId);
    const status = await initialStatus(req, b.submit);
    const p = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sellerId: sellerId(req),
          categoryId: b.categoryId,
          name: b.name,
          slug: uniqueSlug(b.name),
          description: b.description,
          price: D(b.price),
          discountPrice: b.discountPrice ? D(b.discountPrice) : null,
          effectivePrice: effectivePrice(b.price, b.discountPrice),
          unit: b.unit,
          minOrderQty: D(b.minOrderQty),
          weightPerUnitKg: D(b.weightPerUnitKg ?? DEFAULT_UNIT_WEIGHT[b.unit] ?? 1),
          region: b.region,
          district: b.district,
          isSeasonal: b.isSeasonal,
          seasonLabel: b.isSeasonal ? b.seasonLabel ?? null : null,
          isOrganic: b.isOrganic,
          status,
          images: { create: b.images.map((im, i) => ({ url: im.url, thumbUrl: im.thumbUrl ?? null, sortOrder: i })) },
          inventory: { create: { quantity: D(b.stock), lowStockThreshold: D(b.lowStockThreshold) } },
        },
      });
      await syncStockStatus(tx, created.id);
      await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'product.create', entityType: 'Product', entityId: created.id, ip: req.ip } });
      return created;
    });
    if (status === 'pending_review') {
      await notifyAdmins({ type: 'product.moderation', key: 'product.pending', params: { name: p.name }, link: '/admin/products' });
    }
    created(res, p);
  }),
);

async function ownProduct(req: Express.Request & { user?: { sellerId?: string | null } }, id: string) {
  const p = await prisma.product.findFirst({ where: { id, sellerId: req.user!.sellerId!, deletedAt: null }, include: { images: true, inventory: true } });
  if (!p) throw Errors.notFound('Mahsulot');
  return p;
}

r.put(
  '/:id',
  authenticate,
  requireSeller,
  validate({ body: productSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof productSchema>;
    const p = await ownProduct(req, req.params.id);
    await assertCategory(b.categoryId);

    // Kontent o'zgarsa (nom, tavsif, kategoriya, rasm) — qayta moderatsiya. Narx/qoldiq o'zgarishi moderatsiyasiz.
    const contentChanged =
      p.name !== b.name ||
      p.description !== b.description ||
      p.categoryId !== b.categoryId ||
      JSON.stringify(p.images.sort((a, c) => a.sortOrder - c.sortOrder).map((i) => i.url)) !== JSON.stringify(b.images.map((i) => i.url));

    let status = p.status;
    if (!b.submit) status = 'draft';
    else if (['draft', 'rejected', 'inactive'].includes(p.status) || (contentChanged && ['active', 'out_of_stock'].includes(p.status))) {
      status = await initialStatus(req, true);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: p.id } });
      const u = await tx.product.update({
        where: { id: p.id },
        data: {
          categoryId: b.categoryId,
          name: b.name,
          description: b.description,
          price: D(b.price),
          discountPrice: b.discountPrice ? D(b.discountPrice) : null,
          effectivePrice: effectivePrice(b.price, b.discountPrice),
          unit: b.unit,
          minOrderQty: D(b.minOrderQty),
          weightPerUnitKg: D(b.weightPerUnitKg ?? DEFAULT_UNIT_WEIGHT[b.unit] ?? 1),
          region: b.region,
          district: b.district,
          isSeasonal: b.isSeasonal,
          seasonLabel: b.isSeasonal ? b.seasonLabel ?? null : null,
          isOrganic: b.isOrganic,
          status,
          rejectionReason: status === 'pending_review' ? null : p.rejectionReason,
          images: { create: b.images.map((im, i) => ({ url: im.url, thumbUrl: im.thumbUrl ?? null, sortOrder: i })) },
          inventory: { upsert: { create: { quantity: D(b.stock), lowStockThreshold: D(b.lowStockThreshold) }, update: { quantity: D(b.stock), lowStockThreshold: D(b.lowStockThreshold) } } },
        },
      });
      await syncStockStatus(tx, p.id);
      await tx.auditLog.create({ data: { actorId: req.user!.id, action: 'product.update', entityType: 'Product', entityId: p.id, meta: { status }, ip: req.ip } });
      return u;
    });
    if (status === 'pending_review' && p.status !== 'pending_review') {
      await notifyAdmins({ type: 'product.moderation', key: 'product.pending', params: { name: b.name }, link: '/admin/products' });
    }
    ok(res, updated);
  }),
);

/** Qoldiqni xavfsiz o'zgartirish: delta (+/-) atomik, manfiyga tushmaydi */
r.patch(
  '/:id/stock',
  authenticate,
  requireSeller,
  validate({ body: z.object({ delta: z.coerce.number().optional(), quantity: z.coerce.number().min(0).optional() }).refine((v) => v.delta !== undefined || v.quantity !== undefined) }),
  ah(async (req, res) => {
    const p = await ownProduct(req, req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      if (req.body.quantity !== undefined) {
        await tx.productInventory.upsert({ where: { productId: p.id }, create: { productId: p.id, quantity: D(req.body.quantity) }, update: { quantity: D(req.body.quantity) } });
      } else {
        const delta = D(req.body.delta);
        const x = await tx.productInventory.updateMany({
          where: { productId: p.id, ...(delta.isNegative() ? { quantity: { gte: delta.abs() } } : {}) },
          data: { quantity: { increment: delta } },
        });
        if (!x.count) throw Errors.conflict('INSUFFICIENT_STOCK', 'Qoldiq yetarli emas');
      }
      await syncStockStatus(tx, p.id);
      return tx.product.findUnique({ where: { id: p.id }, select: { status: true, inventory: { select: { quantity: true } } } });
    });
    ok(res, result);
  }),
);

r.patch(
  '/:id/visibility',
  authenticate,
  requireSeller,
  validate({ body: z.object({ action: z.enum(['deactivate', 'activate', 'submit']) }) }),
  ah(async (req, res) => {
    const p = await ownProduct(req, req.params.id);
    let status = p.status;
    if (req.body.action === 'deactivate') {
      if (!['active', 'out_of_stock'].includes(p.status)) throw Errors.badRequest('Faqat sotuvdagi mahsulotni yashirish mumkin');
      status = 'inactive';
    } else if (req.body.action === 'activate') {
      if (p.status !== 'inactive') throw Errors.badRequest('Mahsulot yashirilmagan');
      status = 'active'; // avval moderatsiyadan o'tgan
    } else {
      if (!['draft', 'rejected'].includes(p.status)) throw Errors.badRequest("Mahsulot allaqachon yuborilgan");
      status = await initialStatus(req, true);
    }
    const u = await prisma.$transaction(async (tx) => {
      const x = await tx.product.update({ where: { id: p.id }, data: { status } });
      await syncStockStatus(tx, p.id);
      return x;
    });
    if (status === 'pending_review') await notifyAdmins({ type: 'product.moderation', key: 'product.pending', params: { name: p.name }, link: '/admin/products' });
    ok(res, u);
  }),
);

/** O'chirish = arxivlash (soft delete). Buyurtmalar tarixi saqlanib qoladi. */
r.delete(
  '/:id',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const p = await ownProduct(req, req.params.id);
    await prisma.$transaction([
      prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date(), status: 'inactive' } }),
      prisma.cartItem.deleteMany({ where: { productId: p.id } }),
      prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'product.archive', entityType: 'Product', entityId: p.id, ip: req.ip } }),
    ]);
    ok(res, { archived: true });
  }),
);

export default r;
