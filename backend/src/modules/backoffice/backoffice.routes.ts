import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireRole } from '../../middleware/auth';
import { audit } from '../../common/audit';
import { hashPassword, revokeAllSessions } from '../auth/auth.service';
import { passwordSchema } from '../auth/auth.routes';
import { notify } from '../notifications/notifications.service';
import { walletBalance } from '../wallet/wallet.service';
import { withNumber } from './numbering';

/** Admin: foydalanuvchi kartasi va tahrirlash, to'lov cheki, ma'muriy choralar. Har amal audit logga yoziladi. */
const r = Router();
r.use(authenticate, requireRole('ADMIN'));

// ───────── Foydalanuvchi kartasi ─────────
r.get(
  '/users/:id',
  ah(async (req, res) => {
    const u = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true, status: true, locale: true, createdAt: true, lastLoginAt: true, emailVerifiedAt: true, phoneVerifiedAt: true,
        buyerProfile: { select: { companyName: true, isWholesale: true } },
        sellerProfile: {
          select: {
            id: true, farmName: true, slug: true, description: true, region: true, district: true, address: true, tin: true, verificationStatus: true, verifiedAt: true, ratingAvg: true, ratingCount: true,
            _count: { select: { products: { where: { deletedAt: null } }, salesPoints: true, sellerOrders: true } },
          },
        },
        seal: true,
        _count: { select: { orders: true, reviews: true, complaints: true, complaintsAgainst: true, sessions: { where: { revokedAt: null } } } },
      },
    });
    if (!u) throw Errors.notFound('Foydalanuvchi');
    const sid = u.sellerProfile?.id;
    const [orders, sellerOrders, contracts, wallet, sanctions, applications, staffOf, complaints] = await Promise.all([
      prisma.order.findMany({ where: { buyerId: u.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true, createdAt: true } }),
      sid ? prisma.sellerOrder.findMany({ where: { sellerId: sid }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, number: true, total: true, status: true, createdAt: true } }) : Promise.resolve([]),
      prisma.contract.findMany({ where: { OR: [{ buyerId: u.id }, { sellerUserId: u.id }] }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, number: true, title: true, status: true, totalAmount: true, createdAt: true } }),
      u.role === 'SELLER' ? walletBalance(u.id) : Promise.resolve(null),
      prisma.sanction.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } }),
      sid ? prisma.application.findMany({ where: { sellerId: sid }, orderBy: { createdAt: 'desc' }, select: { id: true, number: true, kind: true, status: true, createdAt: true } }) : Promise.resolve([]),
      prisma.farmStaff.findMany({ where: { userId: u.id, status: { not: 'removed' } }, include: { seller: { select: { farmName: true } } } }),
      prisma.complaint.findMany({ where: { OR: [{ reporterId: u.id }, { againstId: u.id }] }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, subject: true, status: true, createdAt: true, reporterId: true } }),
    ]);
    ok(res, { ...u, orders, sellerOrders, contracts, wallet, sanctions, applications, staffOf, complaints });
  }),
);

const editSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  phone: z.string().trim().regex(/^\+998\d{9}$/).nullable().optional(),
  locale: z.enum(['uz', 'ru', 'en']).optional(),
  companyName: z.string().trim().max(120).nullable().optional(),
  seller: z
    .object({
      farmName: z.string().trim().min(2).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
      region: z.string().max(40).optional(),
      district: z.string().max(80).optional(),
      address: z.string().max(300).optional(),
      tin: z.string().regex(/^\d{9}$/).nullable().optional(),
    })
    .optional(),
  reason: z.string().trim().max(300).optional(),
});

/** Admin foydalanuvchi ma'lumotlarini tuzatadi; o'zgarishlar "tuzatish dalolatnomasi" sifatida saqlanadi */
r.patch(
  '/users/:id',
  validate({ body: editSchema }),
  ah(async (req, res) => {
    const body = req.body as z.infer<typeof editSchema>;
    const u = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { sellerProfile: true, buyerProfile: true } });
    if (!u) throw Errors.notFound('Foydalanuvchi');
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const userData: Prisma.UserUpdateInput = {};
    for (const k of ['fullName', 'email', 'phone', 'locale'] as const) {
      if (body[k] !== undefined && body[k] !== u[k]) {
        changes[k] = { from: u[k], to: body[k] };
        (userData as Record<string, unknown>)[k] = body[k];
      }
    }
    if (body.email !== undefined && body.email !== u.email) userData.emailVerifiedAt = null;
    if (body.phone !== undefined && body.phone !== u.phone) userData.phoneVerifiedAt = null;
    const sellerData: Record<string, unknown> = {};
    if (body.seller && u.sellerProfile) {
      for (const [k, v] of Object.entries(body.seller)) {
        const cur = (u.sellerProfile as Record<string, unknown>)[k];
        if (v !== undefined && v !== cur) {
          changes[`seller.${k}`] = { from: cur, to: v };
          sellerData[k] = v;
        }
      }
    }
    if (body.companyName !== undefined && u.buyerProfile && body.companyName !== u.buyerProfile.companyName) changes.companyName = { from: u.buyerProfile.companyName, to: body.companyName };
    if (!Object.keys(changes).length) return ok(res, { changed: 0 });
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: u.id }, data: userData });
        if (Object.keys(sellerData).length) await tx.sellerProfile.update({ where: { id: u.sellerProfile!.id }, data: sellerData });
        if (changes.companyName) await tx.buyerProfile.update({ where: { userId: u.id }, data: { companyName: body.companyName ?? null } });
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new AppError(409, 'DUPLICATE', 'Bu email yoki telefon boshqa foydalanuvchida bor');
      throw e;
    }
    const s = await withNumber('TZ', () => prisma.sanction.count(), (number) =>
      prisma.sanction.create({ data: { number, kind: 'correction', userId: u.id, sellerId: u.sellerProfile?.id ?? null, reason: body.reason || "Ma'lumotlar administrator tomonidan tuzatildi", details: { changes } as Prisma.InputJsonValue, createdById: req.user!.id } }),
    );
    await audit(req, 'user.edit', 'User', u.id, { changes, act: s.number });
    ok(res, { changed: Object.keys(changes).length, act: s.number, sanctionId: s.id });
  }),
);

/** Parolni administrator o'zgartiradi: barcha sessiyalar yopiladi, foydalanuvchiga xabar boradi. Parol logga yozilmaydi. */
r.post(
  '/users/:id/password',
  validate({ body: z.object({ password: passwordSchema }) }),
  ah(async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true, role: true } });
    if (!u) throw Errors.notFound('Foydalanuvchi');
    if (u.id === req.user!.id) throw Errors.badRequest("O'z parolingizni Sozlamalar → Xavfsizlik bo'limida o'zgartiring");
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(req.body.password), failedLoginCount: 0, lockedUntil: null } });
    await revokeAllSessions(u.id);
    await audit(req, 'user.password_reset', 'User', u.id);
    void notify({ userId: u.id, type: 'system', key: 'sanction.issued', params: { number: '—', kind: 'Parol yangilandi', reason: "Administrator parolingizni o'zgartirdi. Yangi parol bilan kiring" } });
    ok(res, { ok: true });
  }),
);

// ───────── To'lov cheki (barcha holatlar) ─────────
r.get(
  '/payments/:id/receipt',
  ah(async (req, res) => {
    const p = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 1 },
        order: { include: { items: { include: { sellerOrder: { select: { seller: { select: { farmName: true } } } } } }, buyer: { select: { fullName: true, phone: true } } } },
      },
    });
    if (!p) throw Errors.notFound("To'lov");
    const o = p.order;
    ok(res, {
      paymentId: p.id,
      receiptNo: `R-${o.orderNumber}`,
      provider: p.provider,
      method: p.method,
      status: p.status,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      providerTxId: p.transactions[0]?.providerTxId ?? null,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      buyer: { name: o.recipientName, phone: o.contactPhone },
      receipt: {
        orderNumber: o.orderNumber,
        createdAt: (p.paidAt ?? o.createdAt).toISOString(),
        items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity.toString(), unit: i.unit, lineTotal: i.lineTotal.toString(), farm: i.sellerOrder?.seller.farmName })),
        subtotal: o.subtotal.toString(),
        deliveryFee: o.deliveryFee.toString(),
        discountTotal: o.discountTotal.toString(),
        total: o.total.toString(),
        paymentMethod: p.method,
        paid: ['paid', 'refunded', 'partially_refunded'].includes(p.status),
      },
    });
  }),
);

// ───────── Ma'muriy choralar (jarima, ogohlantirish, to'xtatish) ─────────
r.get(
  '/sanctions',
  validate({ query: z.object({ userId: z.string().optional(), kind: z.enum(['warning', 'fine', 'suspension', 'correction']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { userId?: string; kind?: 'fine' };
    const rows = await prisma.sanction.findMany({ where: { ...(f.userId ? { userId: f.userId } : {}), ...(f.kind ? { kind: f.kind } : {}) }, orderBy: { createdAt: 'desc' }, take: 200, include: { seller: { select: { farmName: true } } } });
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((x) => x.userId))] } }, select: { id: true, fullName: true, phone: true } });
    const um = new Map(users.map((x) => [x.id, x]));
    ok(res, rows.map((x) => ({ ...x, user: um.get(x.userId) ?? null })));
  }),
);

const sanctionSchema = z
  .object({
    userId: z.string(),
    kind: z.enum(['warning', 'fine', 'suspension']),
    amount: z.number().int().min(1000).max(100_000_000).optional(),
    reason: z.string().trim().min(5).max(500),
    complaintId: z.string().optional(),
    resolveComplaint: z.boolean().default(true),
    deadline: z.string().max(20).optional(),
    basis: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.kind !== 'fine' || v.amount, { path: ['amount'], message: 'Jarima summasini kiriting' });

r.post(
  '/sanctions',
  validate({ body: sanctionSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof sanctionSchema>;
    const u = await prisma.user.findFirst({ where: { id: b.userId, deletedAt: null }, include: { sellerProfile: { select: { id: true, farmName: true } } } });
    if (!u || u.role === 'ADMIN') throw Errors.notFound('Foydalanuvchi');
    if (b.complaintId) {
      const c = await prisma.complaint.findUnique({ where: { id: b.complaintId } });
      if (!c) throw Errors.notFound('Shikoyat');
    }
    const prefix = b.kind === 'fine' ? 'JR' : b.kind === 'warning' ? 'OG' : 'TX';
    const s = await withNumber(prefix, () => prisma.sanction.count(), (number) =>
      prisma.$transaction(async (tx) => {
        const s = await tx.sanction.create({
          data: { number, kind: b.kind, userId: u.id, sellerId: u.sellerProfile?.id ?? null, complaintId: b.complaintId ?? null, amount: b.amount ?? null, reason: b.reason, details: { deadline: b.deadline ?? null, basis: b.basis ?? null }, createdById: req.user!.id },
        });
        if (b.kind === 'fine') {
          await tx.walletTransaction.create({ data: { userId: u.id, kind: 'penalty', amount: new Prisma.Decimal(-b.amount!), refType: 'Sanction', refId: s.id, note: `${number}: ${b.reason}`.slice(0, 300), completedAt: new Date(), processedBy: req.user!.id } });
        }
        if (b.kind === 'suspension') await tx.user.update({ where: { id: u.id }, data: { status: 'BLOCKED' } });
        if (b.complaintId && b.resolveComplaint) {
          await tx.complaint.update({ where: { id: b.complaintId }, data: { status: 'resolved', resolution: `${number}: ${b.reason}`.slice(0, 1000), handledById: req.user!.id } });
        }
        return s;
      }),
    );
    if (b.kind === 'suspension') await revokeAllSessions(u.id);
    await audit(req, `sanction.${b.kind}`, 'Sanction', s.id, { userId: u.id, amount: b.amount, complaintId: b.complaintId });
    void notify({ userId: u.id, type: 'sanction', key: 'sanction.issued', params: { number: s.number, kind: { warning: 'Ogohlantirish', fine: `Jarima ${b.amount ?? ''} so'm`, suspension: "Faoliyat to'xtatildi" }[b.kind], reason: b.reason }, external: true });
    created(res, s);
  }),
);

r.post(
  '/sanctions/:id/cancel',
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const s = await prisma.sanction.findUnique({ where: { id: req.params.id } });
    if (!s) throw Errors.notFound('Chora');
    if (s.status !== 'active') throw new AppError(409, 'ALREADY_PROCESSED', 'Chora allaqachon bekor qilingan');
    await prisma.$transaction(async (tx) => {
      await tx.sanction.update({ where: { id: s.id }, data: { status: 'cancelled', cancelledAt: new Date(), details: { ...(s.details as object), cancelReason: req.body.reason } } });
      if (s.kind === 'fine' && s.amount) {
        await tx.walletTransaction.createMany({ data: [{ userId: s.userId, kind: 'adjustment', amount: s.amount, refType: 'SanctionCancel', refId: s.id, note: `${s.number} bekor qilindi: ${req.body.reason}`.slice(0, 300), completedAt: new Date(), processedBy: req.user!.id }], skipDuplicates: true });
      }
      if (s.kind === 'suspension') await tx.user.update({ where: { id: s.userId }, data: { status: 'ACTIVE' } });
    });
    await audit(req, 'sanction.cancel', 'Sanction', s.id, { reason: req.body.reason });
    ok(res, { ok: true });
  }),
);

export default r;
