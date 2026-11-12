import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate, q } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { isValidRegion } from '../../common/regions';
import { emitToUser } from '../../lib/realtime';
import { notify } from '../notifications/notifications.service';
import { audit } from '../../common/audit';

/**
 * Xarita: fermer xo'jaliklari, sotuv markazlari, omborlar va olib ketish nuqtalari.
 * Jonli yetkazish: kuryer (fermer yoki uning haydovchisi) telefonidan GPS koordinatalari yuboriladi,
 * xaridor buyurtma sahifasida xaritada real vaqtda ko'radi (WebSocket).
 */
const r = Router();

// O'zbekiston chegaralari (biroz zaxira bilan) — xato koordinatalarni rad etish uchun
const lat = z.coerce.number().min(37).max(46);
const lng = z.coerce.number().min(55).max(74);
/** Shu og'irlikdan oshgan buyurtmalar "katta" hisoblanadi — yetkazib berish va jonli kuzatuv tavsiya etiladi */
export const LARGE_ORDER_KG = Number(process.env.LARGE_ORDER_KG ?? 100);

const pointSelect = {
  id: true, type: true, name: true, region: true, district: true, address: true, lat: true, lng: true, phone: true, hours: true, photoUrl: true, isActive: true,
  seller: { select: { id: true, farmName: true, slug: true, logoUrl: true, ratingAvg: true, ratingCount: true, verificationStatus: true, _count: { select: { products: { where: { status: 'active', deletedAt: null } } } } } },
} as const;

/** Ommaviy: xaritadagi nuqtalar (faqat tasdiqlangan fermerlar) */
r.get(
  '/points',
  validate({
    query: z.object({
      south: z.coerce.number().optional(), west: z.coerce.number().optional(), north: z.coerce.number().optional(), east: z.coerce.number().optional(),
      region: z.string().optional(), type: z.enum(['FARM', 'SALES_CENTER', 'WAREHOUSE', 'PICKUP']).optional(), sellerId: z.string().optional(), q: z.string().max(80).optional(),
    }),
  }),
  ah(async (req, res) => {
    const f = q(req) as { south?: number; west?: number; north?: number; east?: number; region?: string; type?: 'FARM'; sellerId?: string; q?: string };
    const bbox = f.south != null && f.west != null && f.north != null && f.east != null ? { lat: { gte: f.south, lte: f.north }, lng: { gte: f.west, lte: f.east } } : {};
    const points = await prisma.salesPoint.findMany({
      where: {
        isActive: true,
        seller: { verificationStatus: 'APPROVED', user: { status: 'ACTIVE', deletedAt: null } },
        ...bbox,
        ...(f.region ? { region: f.region } : {}),
        ...(f.type ? { type: f.type } : {}),
        ...(f.sellerId ? { sellerId: f.sellerId } : {}),
        ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' as const } }, { seller: { farmName: { contains: f.q, mode: 'insensitive' as const } } }, { address: { contains: f.q, mode: 'insensitive' as const } }] } : {}),
      },
      select: pointSelect,
      take: 500,
    });
    res.setHeader('Cache-Control', 'public, max-age=60');
    ok(res, points);
  }),
);

// ───────── Sotuvchi: o'z nuqtalari ─────────
const pointSchema = z.object({
  type: z.enum(['FARM', 'SALES_CENTER', 'WAREHOUSE', 'PICKUP']),
  name: z.string().trim().min(2).max(120),
  region: z.string().refine(isValidRegion, "Viloyat noto'g'ri"),
  district: z.string().max(80).nullable().optional(),
  address: z.string().trim().min(3).max(250),
  lat,
  lng,
  phone: z.string().max(30).nullable().optional(),
  hours: z.string().max(80).nullable().optional(),
  isActive: z.boolean().default(true),
});

r.get('/my-points', authenticate, requireSeller, ah(async (req, res) => ok(res, await prisma.salesPoint.findMany({ where: { sellerId: sellerId(req) }, orderBy: { createdAt: 'asc' } }))));

r.post(
  '/my-points',
  authenticate,
  requireSeller,
  validate({ body: pointSchema }),
  ah(async (req, res) => {
    const count = await prisma.salesPoint.count({ where: { sellerId: sellerId(req) } });
    if (count >= 30) throw Errors.badRequest("Ko'pi bilan 30 ta nuqta");
    const p = await prisma.salesPoint.create({ data: { ...req.body, sellerId: sellerId(req) } });
    await audit(req, 'salespoint.create', 'SalesPoint', p.id);
    created(res, p);
  }),
);

r.put(
  '/my-points/:id',
  authenticate,
  requireSeller,
  validate({ body: pointSchema }),
  ah(async (req, res) => {
    const p = await prisma.salesPoint.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!p) throw Errors.notFound('Nuqta');
    ok(res, await prisma.salesPoint.update({ where: { id: p.id }, data: req.body }));
  }),
);

r.delete(
  '/my-points/:id',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const n = await prisma.salesPoint.deleteMany({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!n.count) throw Errors.notFound('Nuqta');
    ok(res, { ok: true });
  }),
);

// ───────── Jonli yetkazish ─────────
async function loadDelivery(sellerOrderId: string) {
  const so = await prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: { delivery: true, order: { select: { id: true, buyerId: true, orderNumber: true, region: true, district: true, addressLine: true, recipientName: true } }, seller: { select: { id: true, userId: true, farmName: true } } },
  });
  if (!so || !so.delivery) throw Errors.notFound('Yetkazish');
  return so;
}

/** Xaridor / sotuvchi / admin: joriy holat */
r.get(
  '/tracking/:sellerOrderId',
  authenticate,
  ah(async (req, res) => {
    const so = await loadDelivery(req.params.sellerOrderId);
    const u = req.user!;
    if (so.order.buyerId !== u.id && so.seller.userId !== u.id && u.role !== 'ADMIN' && so.delivery!.courierUserId !== u.id) throw Errors.notFound('Yetkazish');
    const d = so.delivery!;
    const points = await prisma.salesPoint.findMany({ where: { sellerId: so.sellerId, isActive: true }, select: { id: true, name: true, type: true, lat: true, lng: true, address: true }, take: 5 });
    ok(res, {
      sellerOrderId: so.id,
      number: so.number,
      status: so.status,
      deliveryStatus: d.status,
      weightKg: d.weightKg,
      large: Number(d.weightKg) >= LARGE_ORDER_KG,
      courierName: d.courierName,
      courierPhone: d.courierPhone,
      trackingActive: d.trackingActive,
      courier: d.courierLat != null && d.courierLng != null ? { lat: d.courierLat, lng: d.courierLng, accuracy: d.courierAccuracy, heading: d.courierHeading, updatedAt: d.courierUpdatedAt } : null,
      origin: d.originLat != null && d.originLng != null ? { lat: d.originLat, lng: d.originLng } : null,
      destination: { region: so.order.region, district: so.order.district, street: so.order.addressLine, recipient: so.order.recipientName },
      farm: so.seller.farmName,
      points,
    });
  }),
);

const posSchema = z.object({ lat, lng, accuracy: z.number().min(0).max(5000).optional(), heading: z.number().min(0).max(360).nullable().optional() });

/** Fermer yoki shu buyurtmaga biriktirilgan faol kuryer (fermer xodimi) */
async function ownSellerOrder(req: Parameters<typeof sellerId>[0], id: string) {
  const so = await loadDelivery(id);
  const u = (req as unknown as { user: { id: string; sellerId?: string | null } }).user;
  if (u.sellerId && so.sellerId === u.sellerId) return so;
  if (so.delivery!.courierUserId === u.id) {
    const staff = await prisma.farmStaff.findFirst({ where: { sellerId: so.sellerId, userId: u.id, status: 'active', role: 'COURIER' } });
    if (staff) return so;
  }
  throw Errors.notFound('Yetkazish');
}

/** Fermer/kuryer: jonli kuzatuvni boshlash (buyurtma "yo'lda" holatida bo'lishi kerak) */
r.post(
  '/tracking/:sellerOrderId/start',
  authenticate,
  validate({ body: posSchema.extend({ courierName: z.string().max(80).optional(), courierPhone: z.string().max(30).optional() }) }),
  ah(async (req, res) => {
    const so = await ownSellerOrder(req, req.params.sellerOrderId);
    if (!['ready_for_delivery', 'shipped'].includes(so.status)) throw new AppError(409, 'TRACKING_NOT_ALLOWED', "Jonli kuzatuv buyurtma yo'lga chiqqanda yoqiladi");
    const now = new Date();
    await prisma.delivery.update({
      where: { id: so.delivery!.id },
      data: {
        trackingActive: true, originLat: req.body.lat, originLng: req.body.lng, courierLat: req.body.lat, courierLng: req.body.lng, courierAccuracy: req.body.accuracy ?? null, courierHeading: req.body.heading ?? null, courierUpdatedAt: now,
        ...(req.body.courierName ? { courierName: req.body.courierName } : {}), ...(req.body.courierPhone ? { courierPhone: req.body.courierPhone } : {}),
      },
    });
    emitToUser(so.order.buyerId, { type: 'courier_location', payload: { sellerOrderId: so.id, orderId: so.order.id, lat: req.body.lat, lng: req.body.lng, active: true, at: now } });
    void notify({ userId: so.order.buyerId, type: 'delivery.tracking', key: 'delivery.tracking', params: { number: so.number }, link: `/account/orders/${so.order.id}` });
    ok(res, { ok: true });
  }),
);

/** Kuryer telefonidan har 5–15 soniyada joylashuv */
r.post(
  '/tracking/:sellerOrderId/location',
  authenticate,
  validate({ body: posSchema }),
  ah(async (req, res) => {
    const so = await ownSellerOrder(req, req.params.sellerOrderId);
    if (!so.delivery!.trackingActive) throw new AppError(409, 'TRACKING_OFF', "Jonli kuzatuv yoqilmagan");
    const now = new Date();
    await prisma.delivery.update({ where: { id: so.delivery!.id }, data: { courierLat: req.body.lat, courierLng: req.body.lng, courierAccuracy: req.body.accuracy ?? null, courierHeading: req.body.heading ?? null, courierUpdatedAt: now } });
    emitToUser(so.order.buyerId, { type: 'courier_location', payload: { sellerOrderId: so.id, orderId: so.order.id, lat: req.body.lat, lng: req.body.lng, heading: req.body.heading ?? null, active: true, at: now } });
    ok(res, { ok: true });
  }),
);

r.post(
  '/tracking/:sellerOrderId/stop',
  authenticate,
  ah(async (req, res) => {
    const so = await ownSellerOrder(req, req.params.sellerOrderId);
    await prisma.delivery.update({ where: { id: so.delivery!.id }, data: { trackingActive: false } });
    emitToUser(so.order.buyerId, { type: 'courier_location', payload: { sellerOrderId: so.id, orderId: so.order.id, active: false } });
    ok(res, { ok: true });
  }),
);

export default r;
