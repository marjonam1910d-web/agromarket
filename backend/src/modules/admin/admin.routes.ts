import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus, Prisma } from '@prisma/client';
import { ah, ok, created, validate, q, pageParams, pageMeta } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireRole } from '../../middleware/auth';
import { audit, SETTING_DEFAULTS, type SettingKey } from '../../common/audit';
import { cache } from '../../lib/redis';
import { revokeAllSessions } from '../auth/auth.service';
import { notify } from '../notifications/notifications.service';
import { transitionSellerOrder } from '../orders/lifecycle';
import { processRefund } from '../payments/payments.service';
import { providerStatus } from '../payments/providers';
import { channelStatus } from '../notifications/channels';
import { recomputeRatings } from '../reviews/reviews.routes';
import { couponData, couponSchema } from '../sellers/sellers.routes';

/** Barcha admin amallari audit logga yoziladi. Admin roli faqat server (seed/CLI) orqali beriladi. */
const r = Router();
r.use(authenticate, requireRole('ADMIN'));

const pageQ = { page: z.coerce.number().optional(), limit: z.coerce.number().optional() };

// ───────── Foydalanuvchilar ─────────
const usersQ = z.object({ ...pageQ, q: z.string().max(80).optional(), role: z.enum(['BUYER', 'SELLER', 'ADMIN']).optional(), status: z.enum(['ACTIVE', 'BLOCKED']).optional() });
/** Foydalanuvchilar kategoriyalar bo'yicha: rol, holat, tasdiq, hudud */
r.get(
  '/users/stats',
  ah(async (_req, res) => {
    const [byRole, byStatus, sellersByStatus, byRegion, newWeek, wholesale] = await Promise.all([
      prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.user.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.sellerProfile.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      prisma.sellerProfile.groupBy({ by: ['region'], _count: { _all: true } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
      prisma.buyerProfile.count({ where: { isWholesale: true } }),
    ]);
    ok(res, {
      roles: Object.fromEntries(byRole.map((x) => [x.role, x._count._all])),
      statuses: Object.fromEntries(byStatus.map((x) => [x.status, x._count._all])),
      sellerVerification: Object.fromEntries(sellersByStatus.map((x) => [x.verificationStatus, x._count._all])),
      sellerRegions: Object.fromEntries(byRegion.map((x) => [x.region, x._count._all])),
      newThisWeek: newWeek,
      wholesaleBuyers: wholesale,
    });
  }),
);

r.get(
  '/users',
  validate({ query: usersQ }),
  ah(async (req, res) => {
    const f = q(req, usersQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(f.role ? { role: f.role } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { OR: [{ fullName: { contains: f.q, mode: 'insensitive' } }, { email: { contains: f.q, mode: 'insensitive' } }, { phone: { contains: f.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true, fullName: true, email: true, phone: true, role: true, status: true, createdAt: true, lastLoginAt: true,
          sellerProfile: { select: { farmName: true, verificationStatus: true } },
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.patch(
  '/users/:id/status',
  validate({ body: z.object({ status: z.enum(['ACTIVE', 'BLOCKED']), reason: z.string().max(300).optional() }) }),
  ah(async (req, res) => {
    if (req.params.id === req.user!.id) throw Errors.badRequest("O'zingizni bloklay olmaysiz");
    const u = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!u) throw Errors.notFound('Foydalanuvchi');
    if (u.role === 'ADMIN') throw Errors.forbidden("Adminni bu yerdan bloklab bo'lmaydi");
    await prisma.user.update({ where: { id: u.id }, data: { status: req.body.status } });
    if (req.body.status === 'BLOCKED') await revokeAllSessions(u.id);
    await audit(req, req.body.status === 'BLOCKED' ? 'user.block' : 'user.unblock', 'User', u.id, { reason: req.body.reason });
    ok(res, { ok: true });
  }),
);

// ───────── Sotuvchilarni tekshirish ─────────
r.get(
  '/sellers',
  validate({ query: z.object({ ...pageQ, status: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']).optional(), q: z.string().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: 'PENDING'; q?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where: Prisma.SellerProfileWhereInput = {
      ...(f.status ? { verificationStatus: f.status } : {}),
      ...(f.q ? { OR: [{ farmName: { contains: f.q, mode: 'insensitive' } }, { tin: { contains: f.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.sellerProfile.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true, status: true } },
          verifications: { orderBy: { createdAt: 'desc' }, take: 3 },
          _count: { select: { products: true, sellerOrders: true } },
        },
      }),
      prisma.sellerProfile.count({ where }),
    ]);
    ok(
      res,
      rows.map((s) => ({
        ...s,
        verifications: s.verifications.map((v) => ({ ...v, documentUrl: `/api/v1/uploads/private?key=${encodeURIComponent(v.documentPath)}` })),
      })),
      pageMeta(total, page, limit),
    );
  }),
);

r.post(
  '/sellers/:id/verify',
  validate({ body: z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().max(500).optional() }).refine((v) => v.decision === 'APPROVED' || (v.note && v.note.length >= 3), { path: ['note'], message: 'Rad etish sababini yozing' }) }),
  ah(async (req, res) => {
    const s = await prisma.sellerProfile.findUnique({ where: { id: req.params.id } });
    if (!s) throw Errors.notFound('Sotuvchi');
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.sellerProfile.update({ where: { id: s.id }, data: { verificationStatus: req.body.decision, verifiedAt: req.body.decision === 'APPROVED' ? now : null } });
      await tx.sellerVerification.updateMany({
        where: { sellerId: s.id, status: 'PENDING' },
        data: { status: req.body.decision, note: req.body.note ?? null, reviewedById: req.user!.id, reviewedAt: now },
      });
    });
    await audit(req, `seller.${req.body.decision.toLowerCase()}`, 'SellerProfile', s.id, { note: req.body.note });
    await cache.del('stats');
    void notify({
      userId: s.userId,
      type: 'seller.verification',
      key: req.body.decision === 'APPROVED' ? 'seller.approved' : 'seller.rejected',
      params: { reason: req.body.note ?? '' },
      link: '/seller/profile',
      external: true,
    });
    ok(res, { status: req.body.decision });
  }),
);

// ───────── Mahsulot moderatsiyasi ─────────
r.get(
  '/products',
  validate({ query: z.object({ ...pageQ, status: z.enum(['draft', 'pending_review', 'active', 'rejected', 'inactive', 'out_of_stock']).optional(), q: z.string().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: 'pending_review'; q?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { name: { contains: f.q, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          inventory: { select: { quantity: true } },
          seller: { select: { farmName: true, verificationStatus: true } },
          category: { select: { nameUz: true, nameRu: true, nameEn: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.post(
  '/products/:id/moderate',
  validate({ body: z.object({ decision: z.enum(['approve', 'reject', 'deactivate']), reason: z.string().max(500).optional() }).refine((v) => v.decision === 'approve' || (v.reason && v.reason.length >= 3), { path: ['reason'], message: 'Sababni yozing' }) }),
  ah(async (req, res) => {
    const p = await prisma.product.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { seller: { select: { userId: true } }, inventory: true } });
    if (!p) throw Errors.notFound('Mahsulot');
    const d = req.body.decision as 'approve' | 'reject' | 'deactivate';
    if (d === 'approve' && p.status !== 'pending_review') throw new AppError(409, 'NOT_PENDING', 'Mahsulot moderatsiyada emas');
    const status = d === 'approve' ? (p.inventory && p.inventory.quantity.greaterThanOrEqualTo(p.minOrderQty) ? 'active' : 'out_of_stock') : d === 'reject' ? 'rejected' : 'inactive';
    await prisma.product.update({ where: { id: p.id }, data: { status, rejectionReason: d === 'approve' ? null : req.body.reason } });
    await audit(req, `product.${d}`, 'Product', p.id, { reason: req.body.reason });
    await cache.del('categories');
    void notify({
      userId: p.seller.userId,
      type: 'product.moderation',
      key: d === 'approve' ? 'product.approved' : 'product.rejected',
      params: { name: p.name, reason: req.body.reason ?? '' },
      link: '/seller/products',
    });
    ok(res, { status });
  }),
);

// ───────── Buyurtmalar nazorati ─────────
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
r.get(
  '/orders',
  validate({ query: z.object({ ...pageQ, status: z.enum(ORDER_STATUSES).optional(), q: z.string().optional(), paymentStatus: z.string().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: OrderStatus; q?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where: Prisma.OrderWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { OR: [{ orderNumber: { contains: f.q, mode: 'insensitive' } }, { recipientName: { contains: f.q, mode: 'insensitive' } }, { contactPhone: { contains: f.q } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { buyer: { select: { fullName: true } }, sellerOrders: { select: { id: true, number: true, status: true, seller: { select: { farmName: true } } } } },
      }),
      prisma.order.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.post(
  '/seller-orders/:soId/status',
  validate({ body: z.object({ status: z.enum(ORDER_STATUSES), reason: z.string().max(300).optional(), courierName: z.string().max(100).optional() }) }),
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findUnique({ where: { id: req.params.soId }, include: { order: { select: { buyerId: true } } } });
    if (!so) throw Errors.notFound('Buyurtma');
    await prisma.$transaction((tx) => transitionSellerOrder(tx, so.id, req.body.status, { id: req.user!.id, role: 'ADMIN' }, { reason: req.body.reason, courierName: req.body.courierName }));
    await audit(req, 'order.status', 'SellerOrder', so.id, { from: so.status, to: req.body.status, reason: req.body.reason });
    void notify({ userId: so.order.buyerId, type: 'order.status', key: 'order.status', params: { number: so.number, status: req.body.status }, link: `/account/orders/${so.orderId}` });
    ok(res, { ok: true });
  }),
);

// ───────── To'lovlar va qaytarishlar ─────────
r.get(
  '/payments',
  validate({ query: z.object({ ...pageQ, status: z.string().optional(), provider: z.string().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: string; provider?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where = { ...(f.status ? { status: f.status as never } : {}), ...(f.provider ? { provider: f.provider as never } : {}) } satisfies Prisma.PaymentWhereInput;
    const [rows, total, sums] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { order: { select: { orderNumber: true, recipientName: true } }, transactions: { select: { providerTxId: true, state: true } } } }),
      prisma.payment.count({ where }),
      prisma.payment.groupBy({ by: ['status'], _sum: { amount: true }, _count: { _all: true } }),
    ]);
    ok(res, rows, { ...pageMeta(total, page, limit), byStatus: sums, providers: providerStatus() });
  }),
);

r.get(
  '/refunds',
  validate({ query: z.object({ ...pageQ, status: z.enum(['requested', 'approved', 'processed', 'rejected']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: 'requested' };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where = f.status ? { status: f.status } : {};
    const [rows, total] = await Promise.all([
      prisma.refund.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { payment: { select: { provider: true, method: true, amount: true, order: { select: { orderNumber: true, id: true } } } }, sellerOrder: { select: { number: true } } } }),
      prisma.refund.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.post(
  '/refunds/:id/process',
  validate({ body: z.object({ approve: z.boolean(), note: z.string().max(300).optional() }) }),
  ah(async (req, res) => ok(res, await processRefund(req.params.id, req.user!.id, req.body.approve, req.body.note))),
);

// ───────── Shikoyatlar ─────────
r.get(
  '/complaints',
  validate({ query: z.object({ ...pageQ, status: z.enum(['open', 'in_review', 'resolved', 'rejected']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: 'open' };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where = f.status ? { status: f.status } : {};
    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { reporter: { select: { fullName: true, phone: true, email: true } }, against: { select: { fullName: true } }, order: { select: { orderNumber: true, id: true } } },
      }),
      prisma.complaint.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.patch(
  '/complaints/:id',
  validate({ body: z.object({ status: z.enum(['open', 'in_review', 'resolved', 'rejected']), resolution: z.string().max(2000).optional() }) }),
  ah(async (req, res) => {
    const c = await prisma.complaint.update({ where: { id: req.params.id }, data: { status: req.body.status, resolution: req.body.resolution, handledById: req.user!.id } });
    await audit(req, 'complaint.update', 'Complaint', c.id, req.body);
    void notify({ userId: c.reporterId, type: 'complaint.update', key: 'complaint.update', params: { subject: c.subject, status: c.status }, link: '/account/support' });
    ok(res, c);
  }),
);

// ───────── Sharhlar moderatsiyasi ─────────
r.get(
  '/reviews',
  validate({ query: z.object({ ...pageQ, status: z.enum(['published', 'hidden']).optional(), reported: z.enum(['true', 'false']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; status?: 'published'; reported?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit);
    const where: Prisma.ReviewWhereInput = { ...(f.status ? { status: f.status } : {}), ...(f.reported === 'true' ? { reportCount: { gt: 0 } } : {}) };
    const [rows, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ reportCount: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        include: { product: { select: { name: true } }, buyer: { select: { fullName: true } }, reports: { select: { reason: true, createdAt: true }, take: 5 } },
      }),
      prisma.review.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

r.patch(
  '/reviews/:id',
  validate({ body: z.object({ status: z.enum(['published', 'hidden']) }) }),
  ah(async (req, res) => {
    const rv = await prisma.$transaction(async (tx) => {
      const x = await tx.review.update({ where: { id: req.params.id }, data: { status: req.body.status, ...(req.body.status === 'published' ? { reportCount: 0 } : {}) } });
      await recomputeRatings(tx, x.productId, x.sellerId);
      return x;
    });
    await audit(req, `review.${req.body.status}`, 'Review', rv.id);
    ok(res, rv);
  }),
);

// ───────── Platforma kuponlari ─────────
r.get('/coupons', ah(async (_req, res) => ok(res, await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, include: { seller: { select: { farmName: true } } } }))));
r.post(
  '/coupons',
  validate({ body: couponSchema }),
  ah(async (req, res) => {
    const c = await prisma.coupon.create({ data: couponData(req.body) });
    await audit(req, 'coupon.create', 'Coupon', c.id, { code: c.code });
    created(res, c);
  }),
);
r.patch(
  '/coupons/:id',
  validate({ body: z.object({ isActive: z.boolean() }) }),
  ah(async (req, res) => {
    const c = await prisma.coupon.update({ where: { id: req.params.id }, data: { isActive: req.body.isActive } });
    await audit(req, 'coupon.toggle', 'Coupon', c.id, req.body);
    ok(res, c);
  }),
);

// ───────── Tizim sozlamalari (komissiya, yetkazish oraliqlari...) ─────────
r.get(
  '/settings',
  ah(async (_req, res) => {
    const rows = await prisma.systemSetting.findMany();
    const map = Object.fromEntries(rows.map((x) => [x.key, x.value]));
    ok(res, { values: { ...SETTING_DEFAULTS, ...map }, integrations: { payments: providerStatus(), channels: channelStatus() } });
  }),
);

const settingSchemas: Record<SettingKey, z.ZodTypeAny> = {
  'commission.percent': z.number().min(0).max(50),
  'products.autoApprove': z.boolean(),
  'orders.buyerCancelStatuses': z.array(z.enum(['pending', 'confirmed'])),
  'delivery.slots': z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)).min(1).max(8),
  'delivery.maxDaysAhead': z.number().int().min(1).max(60),
  'reviews.autoHideReports': z.number().int().min(1).max(100),
  'platform.supportPhone': z.string().max(30),
};

r.put(
  '/settings/:key',
  validate({ body: z.object({ value: z.unknown() }) }),
  ah(async (req, res) => {
    const key = req.params.key as SettingKey;
    const schema = settingSchemas[key];
    if (!schema) throw Errors.notFound('Sozlama');
    const parsed = schema.safeParse(req.body.value);
    if (!parsed.success) throw Errors.validation(parsed.error.issues);
    const before = await prisma.systemSetting.findUnique({ where: { key } });
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: parsed.data as object, updatedById: req.user!.id }, update: { value: parsed.data as object, updatedById: req.user!.id } });
    await audit(req, 'setting.update', 'SystemSetting', key, { before: before?.value ?? SETTING_DEFAULTS[key], after: parsed.data });
    ok(res, { key, value: parsed.data });
  }),
);

// ───────── Audit log ─────────
r.get(
  '/audit-logs',
  validate({ query: z.object({ ...pageQ, action: z.string().optional(), entityType: z.string().optional(), actorId: z.string().optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { page?: number; limit?: number; action?: string; entityType?: string; actorId?: string };
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 50);
    const where: Prisma.AuditLogWhereInput = {
      ...(f.action ? { action: { contains: f.action } } : {}),
      ...(f.entityType ? { entityType: f.entityType } : {}),
      ...(f.actorId ? { actorId: f.actorId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { actor: { select: { fullName: true, role: true } } } }),
      prisma.auditLog.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

export default r;
