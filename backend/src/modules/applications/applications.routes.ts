import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';
import { authenticate, requireRole, requireSeller, sellerId } from '../../middleware/auth';
import { audit, getSetting } from '../../common/audit';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { uniqueSlug, slugify } from '../../common/utils';
import { storage } from '../../lib/storage';
import { D } from '../../common/money';
import { notify, notifyAdmins } from '../notifications/notifications.service';
import { canonical } from '../contracts/contracts.service';
import { syncStockStatus } from '../products/products.service';
import { DEFAULT_UNIT_WEIGHT, effectivePrice } from '../products/pricing';
import { ensureSeal } from '../backoffice/documents.routes';
import { withNumber } from '../backoffice/numbering';
import { verifyPassword } from './password';

/**
 * Elektron arizalar. Har bir ariza:
 *  - davlat namunasidagi ariza shakli maydonlari (data) + ilova hujjatlar (attachments)
 *  - parol bilan tasdiqlanadi, fermer muhri bosiladi, matndan SHA-256 iz olinadi
 *  - admin ko'rib chiqadi: to'liq tasdiqlash, qisman (mahsulotlar paketida tanlanganlari) yoki rad etish
 */
const r = Router();
r.use(authenticate);

const KIND_UZ = { SELLER: "Sotuvchi sifatida ro'yxatdan o'tish", PRODUCTS: 'Mahsulotlarni sotuvga chiqarish', PARTNERSHIP: 'Yetkazish hamkorligi' } as const;
const hashOf = (v: unknown) => crypto.createHash('sha256').update(canonical(v)).digest('hex');

async function sellerCtx(req: Express.Request & { user?: { id: string; sellerId?: string | null } }) {
  const s = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: sellerId(req as never) }, include: { user: { select: { id: true, fullName: true, phone: true, email: true } } } });
  return s;
}

const attachmentSchema = z.object({ key: z.string().startsWith('private/docs/'), name: z.string().max(120), type: z.enum(['certificate', 'license', 'passport', 'farm_registry', 'land', 'other']) });
const ownAttachments = (list: z.infer<typeof attachmentSchema>[], uid: string) => {
  if (list.some((a) => a.key.split('/')[2] !== uid)) throw Errors.forbidden('Hujjat sizga tegishli emas');
};

// ───────── Fermer ─────────
r.get(
  '/mine',
  requireSeller,
  ah(async (req, res) => {
    ok(res, await prisma.application.findMany({ where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'desc' }, include: { items: true } }));
  }),
);

/** Ariza shaklini oldindan to'ldirish uchun mavjud ma'lumotlar */
r.get(
  '/template',
  requireSeller,
  ah(async (req, res) => {
    const s = await sellerCtx(req);
    const [cats, partnership, pendingSeller] = await Promise.all([
      prisma.category.findMany({ where: { OR: [{ isActive: true }, { proposedById: s.id }] }, orderBy: [{ sortOrder: 'asc' }], select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true, parentId: true, isActive: true } }),
      prisma.partnership.findFirst({ where: { sellerId: s.id, status: 'active' } }),
      prisma.application.findFirst({ where: { sellerId: s.id, status: 'pending' }, select: { id: true, kind: true, number: true } }),
    ]);
    ok(res, {
      seller: { fullName: s.user.fullName, phone: s.user.phone, email: s.user.email, farmName: s.farmName, tin: s.tin, region: s.region, district: s.district, address: s.address, verificationStatus: s.verificationStatus },
      categories: cats,
      partnership,
      partnerSharePercent: await getSetting('partner.deliverySharePercent'),
      pending: pendingSeller,
    });
  }),
);

/** Fermer yangi kategoriya taklif qiladi — admin mahsulot/arizani tasdiqlagach faollashadi */
r.post(
  '/categories',
  requireSeller,
  validate({ body: z.object({ nameUz: z.string().trim().min(2).max(60), nameRu: z.string().trim().max(60).optional(), nameEn: z.string().trim().max(60).optional(), parentId: z.string().nullable().optional() }) }),
  ah(async (req, res) => {
    const sid = sellerId(req);
    const exists = await prisma.category.findFirst({ where: { nameUz: { equals: req.body.nameUz, mode: 'insensitive' } } });
    if (exists && (exists.isActive || exists.proposedById === sid)) return ok(res, exists);
    const mine = await prisma.category.count({ where: { proposedById: sid, isActive: false } });
    if (mine >= 10) throw new AppError(429, 'TOO_MANY', "Tasdiqlanmagan kategoriyalar ko'p — admin ko'rib chiqishini kuting");
    if (req.body.parentId && !(await prisma.category.findFirst({ where: { id: req.body.parentId, isActive: true } }))) throw Errors.badRequest('Asosiy kategoriya topilmadi');
    const c = await prisma.category.create({
      data: { slug: `${slugify(req.body.nameUz) || 'kategoriya'}-${crypto.randomBytes(2).toString('hex')}`, nameUz: req.body.nameUz, nameRu: req.body.nameRu || req.body.nameUz, nameEn: req.body.nameEn || req.body.nameUz, parentId: req.body.parentId ?? null, icon: 'Sprout', isActive: false, proposedById: sid, sortOrder: 99 },
    });
    await audit(req, 'category.propose', 'Category', c.id, { name: c.nameUz });
    created(res, c);
  }),
);

const sellerAppSchema = z.object({
  data: z.object({
    fullName: z.string().trim().min(5).max(100),
    position: z.string().trim().min(2).max(60).default('rahbari'),
    phone: z.string().trim().min(9).max(20),
    email: z.string().trim().email().nullable().optional(),
    legalForm: z.enum(['fermer', 'dehqon', 'mchj', 'yatt', 'kooperativ']),
    farmName: z.string().trim().min(2).max(120),
    tin: z.string().regex(/^\d{9}$/, 'STIR 9 ta raqam'),
    regNumber: z.string().trim().min(2).max(40),
    regDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    region: z.string(),
    district: z.string(),
    address: z.string().trim().min(5).max(300),
    landArea: z.coerce.number().min(0).max(100000),
    employees: z.coerce.number().int().min(0).max(100000).default(0),
    activity: z.array(z.string().max(60)).min(1).max(20),
    extra: z.string().max(1000).default(''),
  }),
  attachments: z.array(attachmentSchema).min(1).max(10),
  password: z.string().min(1).max(128),
  agree: z.literal(true),
});

/** 1) Sotuvchi sifatida ro'yxatdan o'tish arizasi */
r.post(
  '/seller',
  requireSeller,
  validate({ body: sellerAppSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof sellerAppSchema>;
    const s = await sellerCtx(req);
    if (s.verificationStatus === 'APPROVED') throw new AppError(409, 'ALREADY_VERIFIED', "Xo'jalik allaqachon tasdiqlangan");
    if (!isValidRegion(b.data.region) || !isValidDistrict(b.data.region, b.data.district)) throw Errors.badRequest("Hudud noto'g'ri");
    await verifyPassword(req.user!.id, b.password);
    ownAttachments(b.attachments, req.user!.id);
    if (await prisma.application.findFirst({ where: { sellerId: s.id, kind: 'SELLER', status: 'pending' } })) throw new AppError(409, 'APPLICATION_PENDING', "Arizangiz ko'rib chiqilmoqda");
    const seal = await ensureSeal(req.user!.id, b.data.farmName, b.data.fullName);
    const app = await withNumber('AR', () => prisma.application.count(), (number) =>
      prisma.$transaction(async (tx) => {
        const a = await tx.application.create({ data: { number, kind: 'SELLER', sellerId: s.id, applicantId: req.user!.id, data: b.data, attachments: b.attachments, sealCode: seal.code, contentHash: hashOf({ number, data: b.data, attachments: b.attachments }) } });
        // eski tekshiruv oqimi bilan moslik: hujjatlar ham SellerVerification sifatida saqlanadi
        await tx.sellerVerification.createMany({ data: b.attachments.map((x) => ({ sellerId: s.id, documentType: x.type === 'land' ? 'other' : x.type, documentPath: x.key })) });
        await tx.sellerProfile.update({ where: { id: s.id }, data: { verificationStatus: 'PENDING', tin: b.data.tin, region: b.data.region, district: b.data.district, address: b.data.address } });
        return a;
      }),
    );
    await audit(req, 'application.submit', 'Application', app.id, { kind: 'SELLER' });
    await notifyAdmins({ type: 'application', key: 'application.submitted', params: { farm: s.farmName, kind: KIND_UZ.SELLER, number: app.number }, link: `/admin/applications/${app.id}` });
    created(res, app);
  }),
);

const imageSchema = z.object({ url: z.string().url(), thumbUrl: z.string().url().optional().nullable() });
const newItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().min(1),
  description: z.string().trim().min(10).max(5000),
  price: z.coerce.number().positive().max(1_000_000_000),
  unit: z.enum(['kg', 'g', 'tonna', 'dona', 'litr', 'qop']),
  stock: z.coerce.number().min(0).max(10_000_000),
  minOrderQty: z.coerce.number().positive().max(100_000).default(1),
  isOrganic: z.boolean().default(false),
  isSeasonal: z.boolean().default(false),
  images: z.array(imageSchema).min(1, 'Kamida bitta rasm').max(8),
});
const productsAppSchema = z.object({
  productIds: z.array(z.string()).max(50).default([]),
  items: z.array(newItemSchema).max(50).default([]),
  note: z.string().max(1000).default(''),
  password: z.string().min(1).max(128),
  agree: z.literal(true),
}).refine((v) => v.productIds.length + v.items.length > 0, { path: ['items'], message: "Kamida bitta mahsulot qo'shing" });

/** 2) Mahsulotlar paketi arizasi: bir nechta mahsulot — bitta ariza; admin tanlab tasdiqlaydi */
r.post(
  '/products',
  requireSeller,
  validate({ body: productsAppSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof productsAppSchema>;
    const s = await sellerCtx(req);
    if (s.verificationStatus !== 'APPROVED') throw new AppError(403, 'SELLER_NOT_VERIFIED', "Avval xo'jalik arizasi tasdiqlanishi kerak");
    await verifyPassword(req.user!.id, b.password);
    if (b.items.some((i) => i.images.some((im) => !storage.isOwnPublicUrl(im.url)))) throw Errors.badRequest('Rasmlar faqat platforma orqali yuklanadi');
    const existing = await prisma.product.findMany({ where: { id: { in: b.productIds }, sellerId: s.id, deletedAt: null } });
    if (existing.length !== b.productIds.length) throw Errors.notFound('Mahsulot');
    if (existing.some((p) => !['draft', 'rejected'].includes(p.status))) throw new AppError(409, 'PRODUCT_NOT_DRAFT', 'Faqat qoralama yoki rad etilgan mahsulotlarni arizaga qo\'shish mumkin');
    const catIds = [...new Set(b.items.map((i) => i.categoryId))];
    const cats = await prisma.category.count({ where: { id: { in: catIds }, OR: [{ isActive: true }, { proposedById: s.id }] } });
    if (cats !== catIds.length) throw Errors.badRequest('Kategoriya topilmadi');
    const seal = await ensureSeal(req.user!.id, s.farmName, s.user.fullName);
    const app = await withNumber('AR', () => prisma.application.count(), (number) =>
      prisma.$transaction(async (tx) => {
        const ids = [...b.productIds];
        for (const it of b.items) {
          const p = await tx.product.create({
            data: {
              sellerId: s.id, categoryId: it.categoryId, name: it.name, slug: uniqueSlug(it.name), description: it.description,
              price: D(it.price), effectivePrice: effectivePrice(it.price, null), unit: it.unit, minOrderQty: D(it.minOrderQty),
              weightPerUnitKg: D(DEFAULT_UNIT_WEIGHT[it.unit] ?? 1), region: s.region, district: s.district, isOrganic: it.isOrganic, isSeasonal: it.isSeasonal,
              status: 'pending_review',
              images: { create: it.images.map((im, i) => ({ url: im.url, thumbUrl: im.thumbUrl ?? null, sortOrder: i })) },
              inventory: { create: { quantity: D(it.stock), lowStockThreshold: D(10) } },
            },
          });
          ids.push(p.id);
        }
        await tx.product.updateMany({ where: { id: { in: b.productIds } }, data: { status: 'pending_review', rejectionReason: null } });
        const snapshot = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, price: true, unit: true, categoryId: true, description: true } });
        return tx.application.create({
          data: {
            number, kind: 'PRODUCTS', sellerId: s.id, applicantId: req.user!.id, sealCode: seal.code,
            data: { note: b.note, products: snapshot.map((p) => ({ ...p, price: p.price.toString() })) } as Prisma.InputJsonValue,
            contentHash: hashOf({ number, products: snapshot.map((p) => ({ ...p, price: p.price.toString() })), note: b.note }),
            items: { create: ids.map((productId) => ({ productId })) },
          },
          include: { items: true },
        });
      }),
    );
    await audit(req, 'application.submit', 'Application', app.id, { kind: 'PRODUCTS', count: app.items.length });
    await notifyAdmins({ type: 'application', key: 'application.submitted', params: { farm: s.farmName, kind: `${KIND_UZ.PRODUCTS} (${app.items.length})`, number: app.number }, link: `/admin/applications/${app.id}` });
    created(res, app);
  }),
);

/** 3) Yetkazish hamkorligi arizasi: fermer yetkazish to'lovining belgilangan foizini platformaga beradi */
r.post(
  '/partnership',
  requireSeller,
  validate({ body: z.object({ couriers: z.coerce.number().int().min(0).max(1000), vehicles: z.string().max(200).default(''), regions: z.array(z.string()).min(1).max(14), note: z.string().max(1000).default(''), password: z.string().min(1).max(128), agree: z.literal(true) }) }),
  ah(async (req, res) => {
    const s = await sellerCtx(req);
    if (s.verificationStatus !== 'APPROVED') throw new AppError(403, 'SELLER_NOT_VERIFIED', "Avval xo'jalik arizasi tasdiqlanishi kerak");
    await verifyPassword(req.user!.id, req.body.password);
    if (await prisma.partnership.findFirst({ where: { sellerId: s.id, status: 'active' } })) throw new AppError(409, 'PARTNERSHIP_ACTIVE', 'Hamkorlik shartnomasi allaqachon faol');
    if (await prisma.application.findFirst({ where: { sellerId: s.id, kind: 'PARTNERSHIP', status: 'pending' } })) throw new AppError(409, 'APPLICATION_PENDING', "Arizangiz ko'rib chiqilmoqda");
    const percent = await getSetting('partner.deliverySharePercent');
    const seal = await ensureSeal(req.user!.id, s.farmName, s.user.fullName);
    const data = { couriers: req.body.couriers, vehicles: req.body.vehicles, regions: req.body.regions, note: req.body.note, proposedPercent: percent, farmName: s.farmName, fullName: s.user.fullName, tin: s.tin };
    const app = await withNumber('AR', () => prisma.application.count(), (number) =>
      prisma.application.create({ data: { number, kind: 'PARTNERSHIP', sellerId: s.id, applicantId: req.user!.id, data, sealCode: seal.code, contentHash: hashOf({ number, data }) } }),
    );
    await audit(req, 'application.submit', 'Application', app.id, { kind: 'PARTNERSHIP' });
    await notifyAdmins({ type: 'application', key: 'application.submitted', params: { farm: s.farmName, kind: KIND_UZ.PARTNERSHIP, number: app.number }, link: `/admin/applications/${app.id}` });
    created(res, app);
  }),
);

r.post(
  '/:id/withdraw',
  requireSeller,
  ah(async (req, res) => {
    const a = await prisma.application.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) }, include: { items: true } });
    if (!a) throw Errors.notFound('Ariza');
    if (a.status !== 'pending') throw new AppError(409, 'ALREADY_PROCESSED', "Ariza allaqachon ko'rib chiqilgan");
    await prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { id: a.id }, data: { status: 'withdrawn' } });
      const pids = a.items.map((i) => i.productId).filter(Boolean) as string[];
      if (pids.length) await tx.product.updateMany({ where: { id: { in: pids }, status: 'pending_review' }, data: { status: 'draft' } });
      if (a.kind === 'SELLER') await tx.sellerProfile.update({ where: { id: a.sellerId }, data: { verificationStatus: 'NOT_SUBMITTED' } });
    });
    ok(res, { ok: true });
  }),
);

/** Ariza tafsiloti — fermerning o'zi yoki admin */
r.get(
  '/:id',
  ah(async (req, res) => {
    const a = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        seller: { select: { id: true, farmName: true, slug: true, region: true, district: true, address: true, tin: true, verificationStatus: true, userId: true, user: { select: { fullName: true, phone: true, email: true } } } },
      },
    });
    if (!a) throw Errors.notFound('Ariza');
    if (req.user!.role !== 'ADMIN' && a.seller.userId !== req.user!.id) throw Errors.forbidden();
    const pids = a.items.map((i) => i.productId).filter(Boolean) as string[];
    const [products, seal, partnership] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: pids } },
        select: { id: true, name: true, slug: true, description: true, price: true, unit: true, minOrderQty: true, isOrganic: true, status: true, rejectionReason: true, category: { select: { id: true, nameUz: true, nameRu: true, nameEn: true, isActive: true, proposedById: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 4, select: { url: true, thumbUrl: true } }, inventory: { select: { quantity: true } } },
      }),
      prisma.userSeal.findUnique({ where: { userId: a.applicantId } }),
      a.kind === 'PARTNERSHIP' ? prisma.partnership.findUnique({ where: { applicationId: a.id } }) : Promise.resolve(null),
    ]);
    const pm = new Map(products.map((p) => [p.id, p]));
    ok(res, { ...a, items: a.items.map((i) => ({ ...i, product: i.productId ? pm.get(i.productId) ?? null : null })), seal, partnership });
  }),
);

// ───────── Admin ─────────
r.get(
  '/',
  requireRole('ADMIN'),
  validate({ query: z.object({ kind: z.enum(['SELLER', 'PRODUCTS', 'PARTNERSHIP']).optional(), status: z.enum(['pending', 'approved', 'partially_approved', 'rejected', 'withdrawn']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { kind?: 'SELLER'; status?: 'pending' };
    const where: Prisma.ApplicationWhereInput = { ...(f.kind ? { kind: f.kind } : {}), ...(f.status ? { status: f.status } : {}) };
    const [rows, counts] = await Promise.all([
      prisma.application.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: { _count: { select: { items: true } }, seller: { select: { farmName: true, region: true, user: { select: { fullName: true, phone: true } } } } } }),
      prisma.application.groupBy({ by: ['kind', 'status'], _count: { _all: true } }),
    ]);
    ok(res, rows, { counts: counts.map((c) => ({ kind: c.kind, status: c.status, n: c._count._all })) });
  }),
);

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).default(''),
  /** PRODUCTS: tasdiqlanadigan mahsulotlar; qolganlari rad etiladi */
  approveItemIds: z.array(z.string()).max(100).optional(),
  itemNotes: z.record(z.string(), z.string().max(300)).default({}),
  /** PARTNERSHIP: admin foizni o'zgartirishi mumkin */
  sharePercent: z.coerce.number().min(0).max(50).optional(),
}).refine((v) => v.decision === 'approve' || v.note.length >= 3, { path: ['note'], message: 'Rad etish sababini yozing' });

r.post(
  '/:id/review',
  requireRole('ADMIN'),
  validate({ body: reviewSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof reviewSchema>;
    const a = await prisma.application.findUnique({ where: { id: req.params.id }, include: { items: true, seller: { select: { id: true, userId: true, farmName: true } } } });
    if (!a) throw Errors.notFound('Ariza');
    if (a.status !== 'pending') throw new AppError(409, 'ALREADY_PROCESSED', "Ariza allaqachon ko'rib chiqilgan");
    const now = new Date();
    let status: 'approved' | 'partially_approved' | 'rejected' = b.decision === 'approve' ? 'approved' : 'rejected';
    let partnershipNumber: string | null = null;
    await prisma.$transaction(async (tx) => {
      if (a.kind === 'SELLER') {
        const v = b.decision === 'approve' ? 'APPROVED' : 'REJECTED';
        await tx.sellerProfile.update({ where: { id: a.sellerId }, data: { verificationStatus: v, verifiedAt: v === 'APPROVED' ? now : null } });
        await tx.sellerVerification.updateMany({ where: { sellerId: a.sellerId, status: 'PENDING' }, data: { status: v, note: b.note || null, reviewedById: req.user!.id, reviewedAt: now } });
      }
      if (a.kind === 'PRODUCTS') {
        const approveSet = new Set(b.decision === 'approve' ? (b.approveItemIds ?? a.items.map((i) => i.id)) : []);
        let approved = 0;
        for (const it of a.items) {
          const yes = approveSet.has(it.id);
          if (yes) approved++;
          await tx.applicationItem.update({ where: { id: it.id }, data: { status: yes ? 'approved' : 'rejected', note: b.itemNotes[it.id] ?? (yes ? null : b.note || null) } });
          if (!it.productId) continue;
          const p = await tx.product.findUnique({ where: { id: it.productId }, include: { inventory: true } });
          if (!p || p.deletedAt) continue;
          if (yes) {
            const st = p.inventory && p.inventory.quantity.greaterThanOrEqualTo(p.minOrderQty) ? 'active' : 'out_of_stock';
            await tx.product.update({ where: { id: p.id }, data: { status: st, rejectionReason: null } });
            await tx.category.updateMany({ where: { id: p.categoryId, isActive: false, proposedById: { not: null } }, data: { isActive: true } });
            await syncStockStatus(tx, p.id);
          } else {
            await tx.product.update({ where: { id: p.id }, data: { status: 'rejected', rejectionReason: (b.itemNotes[it.id] ?? b.note) || 'Ariza bo\'yicha rad etildi' } });
          }
        }
        status = approved === 0 ? 'rejected' : approved === a.items.length ? 'approved' : 'partially_approved';
      }
      if (a.kind === 'PARTNERSHIP' && b.decision === 'approve') {
        const d = a.data as { proposedPercent: number; regions: string[]; couriers: number };
        const percent = b.sharePercent ?? d.proposedPercent;
        const terms = {
          subject: "Platforma fermer xo'jaligiga buyurtmalarni qabul qilish, kuryer kabinetlari va jonli kuzatuv xizmatini taqdim etadi; fermer o'z kuryerlari orqali yetkazib beradi.",
          share: `Har bir yetkazilgan buyurtmaning yetkazish to'lovidan ${percent}% platforma ulushi sifatida fermer hamyonidan avtomatik yechiladi. Hisob-kitob oylik ko'chirmada ko'rsatiladi.`,
          regions: d.regions,
          couriers: d.couriers,
          duties: "Fermer buyurtmani kelishilgan muddatda yetkazadi, kuryer joylashuvini xaridorga ko'rsatadi; platforma texnik ishlashni va to'lov hisobini ta'minlaydi.",
          term: "Shartnoma imzolangan kundan boshlab muddatsiz amal qiladi; tomonlardan biri 30 kun oldin ogohlantirib bekor qilishi mumkin.",
        };
        const n = await tx.partnership.count();
        partnershipNumber = `HM-${now.getFullYear()}-${String(n + 1).padStart(6, '0')}`;
        await tx.partnership.create({
          data: { number: partnershipNumber, sellerId: a.sellerId, applicationId: a.id, deliverySharePercent: new Prisma.Decimal(percent), terms, contentHash: hashOf({ number: partnershipNumber, terms, percent }), sellerSignedAt: a.createdAt, adminSignedAt: now, adminId: req.user!.id },
        });
      }
      await tx.application.update({ where: { id: a.id }, data: { status, reviewedById: req.user!.id, reviewedAt: now, reviewNote: b.note || null } });
    });
    await cache.del('categories');
    await audit(req, `application.${status}`, 'Application', a.id, { kind: a.kind, note: b.note, partnership: partnershipNumber });
    const result = { approved: 'Tasdiqlandi', partially_approved: 'Qisman tasdiqlandi', rejected: 'Rad etildi' }[status];
    void notify({ userId: a.seller.userId, type: 'application', key: 'application.reviewed', params: { number: a.number, result, note: b.note }, link: '/seller/applications', external: true });
    ok(res, { status, partnership: partnershipNumber });
  }),
);

/** Admin: hamkorlikni tugatish */
r.post(
  '/partnerships/:id/end',
  requireRole('ADMIN'),
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const p = await prisma.partnership.findUnique({ where: { id: req.params.id } });
    if (!p || p.status !== 'active') throw Errors.notFound('Hamkorlik');
    await prisma.partnership.update({ where: { id: p.id }, data: { status: 'ended', endedAt: new Date() } });
    await audit(req, 'partnership.end', 'Partnership', p.id, { reason: req.body.reason });
    ok(res, { ok: true });
  }),
);

export default r;
