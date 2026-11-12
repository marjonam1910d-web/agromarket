import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus } from '@prisma/client';
import { ah, ok, created, validate } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { audit } from '../../common/audit';
import { notify } from '../notifications/notifications.service';
import { sendEmail } from '../notifications/channels';
import { transitionSellerOrder } from '../orders/lifecycle';
import { emitToUser } from '../../lib/realtime';

/**
 * Fermer xo'jaligi xodimlari.
 *  - Faqat platforma bilan yetkazish hamkorligi faol fermer xodim qo'sha oladi.
 *  - Xodim avval o'zi ro'yxatdan o'tgan bo'ladi; fermer uning emailini kiritadi → emailga 6 xonali kod boradi →
 *    xodim «Ish joyi» bo'limida kodni kiritib qo'shiladi. Kod xeshlangan holda saqlanadi, 24 soat amal qiladi, 5 urinish.
 *  - KURYER: biriktirilgan yetkazishlar, jonli joylashuv, «Yetkazildi». SOTUVCHI: xo'jalik buyurtmalarini qabul qiladi va tayyorlaydi.
 */
const r = Router();
r.use(authenticate);

const ROLE_UZ = { COURIER: 'kuryer', SALES: 'sotuvchi' } as const;
const CODE_TTL = 24 * 3600_000;
const hashCode = (id: string, code: string) => crypto.createHmac('sha256', env.OTP_SECRET).update(`staff|${id}|${code}`).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

async function sendInvite(inviteId: string, email: string, farm: string, role: 'COURIER' | 'SALES', userId: string | null) {
  const code = newCode();
  await prisma.farmStaff.update({ where: { id: inviteId }, data: { codeHash: hashCode(inviteId, code), codeExpires: new Date(Date.now() + CODE_TTL), attempts: 0 } });
  const text = `${farm} sizni AgroMarket'da ${ROLE_UZ[role]} sifatida ishga taklif qildi.\n\nTasdiqlash kodi: ${code}\n\nIlovada «Ish joyi» bo'limiga kirib kodni kiriting. Kod 24 soat amal qiladi. Agar siz kutmagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.`;
  const r = await sendEmail(email, `AgroMarket: ${farm} — ishga taklif (kod ${code})`, text);
  if (userId) void notify({ userId, type: 'staff', key: 'staff.invited', params: { farm, role: ROLE_UZ[role] }, link: '/work' });
  return { delivered: r.delivered, ...(env.otpDevEcho && !r.delivered ? { devCode: code } : {}) };
}

// ───────── Fermer: xodimlarni boshqarish ─────────
r.get(
  '/',
  requireSeller,
  ah(async (req, res) => {
    const sid = sellerId(req);
    const [staff, partnership] = await Promise.all([
      prisma.farmStaff.findMany({ where: { sellerId: sid, status: { not: 'removed' } }, orderBy: { invitedAt: 'desc' } }),
      prisma.partnership.findFirst({ where: { sellerId: sid, status: 'active' } }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: staff.map((s) => s.userId).filter(Boolean) as string[] } }, select: { id: true, fullName: true, phone: true } });
    const um = new Map(users.map((u) => [u.id, u]));
    const active = await prisma.delivery.groupBy({ by: ['courierUserId'], where: { courierUserId: { in: users.map((u) => u.id) }, sellerOrder: { status: { in: ['ready_for_delivery', 'shipped'] } } }, _count: { _all: true } });
    const am = new Map(active.map((a) => [a.courierUserId, a._count._all]));
    ok(res, {
      partnership,
      staff: staff.map(({ codeHash: _h, ...s }) => ({ ...s, user: s.userId ? um.get(s.userId) ?? null : null, activeDeliveries: s.userId ? am.get(s.userId) ?? 0 : 0 })),
    });
  }),
);

r.post(
  '/invite',
  requireSeller,
  authLimiter(),
  validate({ body: z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['COURIER', 'SALES']) }) }),
  ah(async (req, res) => {
    const sid = sellerId(req);
    const seller = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: sid }, select: { farmName: true, userId: true } });
    if (!(await prisma.partnership.findFirst({ where: { sellerId: sid, status: 'active' } }))) throw new AppError(403, 'PARTNERSHIP_REQUIRED', "Xodim qo'shish uchun avval platforma bilan yetkazish hamkorligi shartnomasini tuzing");
    const user = await prisma.user.findFirst({ where: { email: req.body.email, deletedAt: null }, select: { id: true, role: true, status: true } });
    if (!user) throw new AppError(404, 'USER_NOT_REGISTERED', "Bu email bilan foydalanuvchi topilmadi — xodim avval AgroMarket'da ro'yxatdan o'tsin");
    if (user.id === seller.userId || user.role === 'ADMIN') throw Errors.badRequest("Bu foydalanuvchini xodim qilib bo'lmaydi");
    if (user.status !== 'ACTIVE') throw Errors.badRequest('Foydalanuvchi bloklangan');
    if ((await prisma.farmStaff.count({ where: { sellerId: sid, status: { not: 'removed' } } })) >= 50) throw new AppError(429, 'TOO_MANY', "Xodimlar soni chegarasi — 50");
    const inv = await prisma.farmStaff.upsert({
      where: { sellerId_email: { sellerId: sid, email: req.body.email } },
      create: { sellerId: sid, email: req.body.email, role: req.body.role, userId: user.id },
      update: { role: req.body.role, status: 'invited', userId: user.id, removedAt: null, joinedAt: null, invitedAt: new Date() },
    });
    const sent = await sendInvite(inv.id, inv.email, seller.farmName, inv.role, user.id);
    await audit(req, 'staff.invite', 'FarmStaff', inv.id, { role: inv.role });
    created(res, { id: inv.id, status: inv.status, ...sent });
  }),
);

r.post(
  '/:id/resend',
  requireSeller,
  authLimiter(),
  ah(async (req, res) => {
    const inv = await prisma.farmStaff.findFirst({ where: { id: req.params.id, sellerId: sellerId(req), status: 'invited' }, include: { seller: { select: { farmName: true } } } });
    if (!inv) throw Errors.notFound('Taklif');
    ok(res, await sendInvite(inv.id, inv.email, inv.seller.farmName, inv.role, inv.userId));
  }),
);

r.delete(
  '/:id',
  requireSeller,
  ah(async (req, res) => {
    const inv = await prisma.farmStaff.findFirst({ where: { id: req.params.id, sellerId: sellerId(req), status: { not: 'removed' } } });
    if (!inv) throw Errors.notFound('Xodim');
    await prisma.$transaction(async (tx) => {
      await tx.farmStaff.update({ where: { id: inv.id }, data: { status: 'removed', removedAt: new Date(), codeHash: null } });
      if (inv.userId) await tx.delivery.updateMany({ where: { courierUserId: inv.userId, sellerOrder: { sellerId: inv.sellerId, status: { in: ['ready_for_delivery', 'shipped'] } } }, data: { courierUserId: null, trackingActive: false } });
    });
    await audit(req, 'staff.remove', 'FarmStaff', inv.id);
    ok(res, { ok: true });
  }),
);

/** Buyurtmaga kuryer biriktirish */
r.post(
  '/assign/:sellerOrderId',
  requireSeller,
  validate({ body: z.object({ staffId: z.string().nullable() }) }),
  ah(async (req, res) => {
    const sid = sellerId(req);
    const so = await prisma.sellerOrder.findFirst({ where: { id: req.params.sellerOrderId, sellerId: sid }, include: { delivery: true, order: { select: { region: true, district: true, addressLine: true } } } });
    if (!so || !so.delivery) throw Errors.notFound('Yetkazish');
    if (!['confirmed', 'preparing', 'ready_for_delivery', 'shipped'].includes(so.status)) throw new AppError(409, 'ORDER_CLOSED', 'Bu bosqichda kuryer biriktirib bo\'lmaydi');
    if (!req.body.staffId) {
      await prisma.delivery.update({ where: { id: so.delivery.id }, data: { courierUserId: null, trackingActive: false } });
      return ok(res, { ok: true });
    }
    const st = await prisma.farmStaff.findFirst({ where: { id: req.body.staffId, sellerId: sid, status: 'active', role: 'COURIER' } });
    if (!st?.userId) throw Errors.notFound('Kuryer');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.userId }, select: { fullName: true, phone: true } });
    await prisma.delivery.update({ where: { id: so.delivery.id }, data: { courierUserId: st.userId, courierName: u.fullName, courierPhone: u.phone } });
    await audit(req, 'staff.assign', 'SellerOrder', so.id, { courier: st.userId });
    void notify({ userId: st.userId, type: 'staff', key: 'staff.assigned', params: { number: so.number, address: [so.order.district, so.order.addressLine].filter(Boolean).join(', ') }, link: '/work', external: true });
    ok(res, { ok: true, courierName: u.fullName });
  }),
);

// ───────── Xodim: takliflar va ish kabineti ─────────
r.get(
  '/me',
  ah(async (req, res) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { email: true } });
    const rows = await prisma.farmStaff.findMany({
      where: { OR: [{ userId: req.user!.id }, ...(u.email ? [{ email: u.email }] : [])], status: { in: ['invited', 'active'] } },
      include: { seller: { select: { id: true, farmName: true, slug: true, region: true, district: true, logoUrl: true } } },
      orderBy: { invitedAt: 'desc' },
    });
    ok(res, rows.map(({ codeHash: _h, ...x }) => ({ ...x, expired: x.status === 'invited' && (!x.codeExpires || x.codeExpires < new Date()) })));
  }),
);

r.post(
  '/accept',
  authLimiter(),
  validate({ body: z.object({ inviteId: z.string(), code: z.string().regex(/^\d{6}$/) }) }),
  ah(async (req, res) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { id: true, email: true } });
    const inv = await prisma.farmStaff.findFirst({ where: { id: req.body.inviteId, status: 'invited', OR: [{ userId: u.id }, ...(u.email ? [{ email: u.email }] : [])] } });
    if (!inv || !inv.codeHash) throw Errors.notFound('Taklif');
    if (!inv.codeExpires || inv.codeExpires < new Date()) throw new AppError(410, 'CODE_EXPIRED', "Kod muddati o'tgan — fermerdan qayta yuborishni so'rang");
    if (inv.attempts >= 5) throw new AppError(429, 'TOO_MANY_ATTEMPTS', "Urinishlar tugadi — fermerdan yangi kod so'rang");
    const a = Buffer.from(hashCode(inv.id, req.body.code), 'hex');
    const b = Buffer.from(inv.codeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await prisma.farmStaff.update({ where: { id: inv.id }, data: { attempts: { increment: 1 } } });
      throw new AppError(400, 'INVALID_CODE', "Kod noto'g'ri");
    }
    await prisma.farmStaff.update({ where: { id: inv.id }, data: { status: 'active', userId: u.id, joinedAt: new Date(), codeHash: null, codeExpires: null } });
    await audit(req, 'staff.join', 'FarmStaff', inv.id);
    ok(res, { ok: true });
  }),
);

r.post(
  '/:id/leave',
  ah(async (req, res) => {
    const n = await prisma.farmStaff.updateMany({ where: { id: req.params.id, userId: req.user!.id, status: 'active' }, data: { status: 'removed', removedAt: new Date() } });
    if (!n.count) throw Errors.notFound('Xodim');
    ok(res, { ok: true });
  }),
);

async function membership(userId: string, role: 'COURIER' | 'SALES') {
  return prisma.farmStaff.findMany({ where: { userId, status: 'active', role }, select: { sellerId: true } });
}

/** Kuryer: menga biriktirilgan yetkazishlar */
r.get(
  '/work/deliveries',
  ah(async (req, res) => {
    const m = await membership(req.user!.id, 'COURIER');
    if (!m.length) return ok(res, []);
    const rows = await prisma.sellerOrder.findMany({
      where: { sellerId: { in: m.map((x) => x.sellerId) }, delivery: { courierUserId: req.user!.id }, status: { in: ['confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered'] }, updatedAt: { gte: new Date(Date.now() - 14 * 86400_000) } },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: { select: { productName: true, quantity: true, unit: true } },
        delivery: { select: { status: true, weightKg: true, trackingActive: true, scheduledDate: true, slot: true, deliveredAt: true } },
        seller: { select: { farmName: true } },
        order: { select: { id: true, recipientName: true, contactPhone: true, region: true, district: true, addressLine: true, deliveryNotes: true, paymentMethod: true, paymentStatus: true, total: true } },
      },
      take: 100,
    });
    ok(res, rows);
  }),
);

async function courierOrder(userId: string, soId: string) {
  const so = await prisma.sellerOrder.findFirst({ where: { id: soId, delivery: { courierUserId: userId } }, include: { delivery: true, order: { select: { id: true, buyerId: true } } } });
  if (!so) throw Errors.notFound('Yetkazish');
  const st = await prisma.farmStaff.findFirst({ where: { sellerId: so.sellerId, userId, status: 'active', role: 'COURIER' } });
  if (!st) throw Errors.forbidden();
  return so;
}

r.post(
  '/work/deliveries/:soId/:action',
  ah(async (req, res) => {
    const action = req.params.action;
    if (!['ship', 'delivered'].includes(action)) throw Errors.notFound('Amal');
    const so = await courierOrder(req.user!.id, req.params.soId);
    const to: OrderStatus = action === 'ship' ? 'shipped' : 'delivered';
    const need = action === 'ship' ? 'ready_for_delivery' : 'shipped';
    if (so.status !== need) throw new AppError(409, 'WRONG_STATUS', action === 'ship' ? "Buyurtma hali tayyor emas" : "Avval «Yo'lga chiqdim» ni bosing");
    await prisma.$transaction((tx) => transitionSellerOrder(tx, so.id, to, { id: req.user!.id, role: 'SELLER' }, { note: action === 'ship' ? 'Kuryer yo\'lga chiqdi' : 'Kuryer topshirdi' }));
    if (to === 'delivered' && so.delivery) {
      await prisma.delivery.update({ where: { id: so.delivery.id }, data: { trackingActive: false } });
      emitToUser(so.order.buyerId, { type: 'courier_location', payload: { sellerOrderId: so.id, orderId: so.order.id, active: false } });
    }
    await audit(req, `staff.${action}`, 'SellerOrder', so.id);
    ok(res, { ok: true });
  }),
);

/** Sotuvchi xodim: xo'jalik buyurtmalarini qabul qiladi va tayyorlaydi */
r.get(
  '/work/orders',
  ah(async (req, res) => {
    const m = await membership(req.user!.id, 'SALES');
    if (!m.length) return ok(res, []);
    ok(res, await prisma.sellerOrder.findMany({
      where: { sellerId: { in: m.map((x) => x.sellerId) }, status: { in: ['pending', 'confirmed', 'preparing', 'ready_for_delivery'] } },
      orderBy: { createdAt: 'asc' },
      include: { items: { select: { productName: true, quantity: true, unit: true, lineTotal: true } }, seller: { select: { farmName: true } }, order: { select: { recipientName: true, district: true, deliveryDate: true, deliverySlot: true, paymentMethod: true } } },
      take: 200,
    }));
  }),
);

r.post(
  '/work/orders/:soId/status',
  validate({ body: z.object({ status: z.enum(['confirmed', 'preparing', 'ready_for_delivery']) }) }),
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findUnique({ where: { id: req.params.soId } });
    if (!so) throw Errors.notFound('Buyurtma');
    const st = await prisma.farmStaff.findFirst({ where: { sellerId: so.sellerId, userId: req.user!.id, status: 'active', role: 'SALES' } });
    if (!st) throw Errors.forbidden();
    await prisma.$transaction((tx) => transitionSellerOrder(tx, so.id, req.body.status, { id: req.user!.id, role: 'SELLER' }, { note: 'Xodim' }));
    await audit(req, 'staff.order_status', 'SellerOrder', so.id, { to: req.body.status });
    ok(res, { ok: true });
  }),
);

export default r;
