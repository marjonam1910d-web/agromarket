import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus, Prisma } from '@prisma/client';
import { ah, ok, created, validate, q, pageParams, pageMeta } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { normalizePhone } from '../../common/utils';
import { emitToUser } from '../../lib/realtime';
import { checkout } from './checkout.service';
import { allowedTransitions, transitionSellerOrder } from './lifecycle';
import { checkoutUrl } from '../payments/providers';
import { notify } from '../notifications/notifications.service';

const r = Router();
r.use(authenticate);

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;

// ───────── Checkout ─────────
const checkoutSchema = z
  .object({
    addressId: z.string().optional(),
    address: z
      .object({
        recipientName: z.string().trim().min(2).max(100),
        phone: z.string(),
        region: z.string(),
        district: z.string(),
        street: z.string().trim().min(3).max(250),
        landmark: z.string().max(250).optional().nullable(),
      })
      .optional(),
    saveAddress: z.boolean().default(false),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deliverySlot: z.string(),
    deliveryNotes: z.string().max(500).optional().nullable(),
    paymentMethod: z.enum(['cash', 'payme', 'click', 'card']),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Shartlarga rozilik kerak' }) }),
  })
  .refine((v) => v.addressId || v.address, { message: 'Manzil kerak', path: ['address'] });

r.post(
  '/checkout',
  validate({ body: checkoutSchema }),
  ah(async (req, res) => {
    if (req.user!.role === 'ADMIN') throw Errors.forbidden('Admin xarid qila olmaydi');
    const b = req.body as z.infer<typeof checkoutSchema>;
    let address;
    if (b.addressId) {
      const a = await prisma.address.findFirst({ where: { id: b.addressId, userId: req.user!.id, deletedAt: null } });
      if (!a) throw Errors.notFound('Manzil');
      address = a;
    } else {
      const phone = normalizePhone(b.address!.phone);
      if (!phone) throw Errors.validation([{ path: 'address.phone', message: "Telefon raqam noto'g'ri" }]);
      address = { ...b.address!, phone };
      if (b.saveAddress) {
        const count = await prisma.address.count({ where: { userId: req.user!.id, deletedAt: null } });
        if (count < 10) await prisma.address.create({ data: { ...address, userId: req.user!.id, isDefault: count === 0 } });
      }
    }
    const key = req.get('idempotency-key');
    const result = await checkout(req.user!.id, {
      address,
      deliveryDate: b.deliveryDate,
      deliverySlot: b.deliverySlot,
      deliveryNotes: b.deliveryNotes,
      paymentMethod: b.paymentMethod,
      idempotencyKey: key ? `${req.user!.id}:${key}`.slice(0, 120) : null,
    });
    const p = result.payment;
    created(res, {
      order: result.order,
      payment: p ? { id: p.id, provider: p.provider, status: p.status, sandbox: p.provider === 'sandbox', checkoutUrl: checkoutUrl(p) } : null,
      replay: result.replay,
    });
  }),
);

// ───────── Xaridor buyurtmalari ─────────
const listQ = z.object({ status: z.enum(STATUSES).optional(), page: z.coerce.number().optional(), limit: z.coerce.number().optional() });

r.get(
  '/',
  validate({ query: listQ }),
  ah(async (req, res) => {
    const f = q(req, listQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 10);
    const where: Prisma.OrderWhereInput = { buyerId: req.user!.id, ...(f.status ? { status: f.status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: { select: { id: true, productName: true, imageUrl: true, quantity: true, unit: true }, take: 4 },
          _count: { select: { items: true } },
          sellerOrders: { select: { id: true, status: true, seller: { select: { farmName: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    ok(res, rows, pageMeta(total, page, limit));
  }),
);

const orderInclude = {
  sellerOrders: {
    orderBy: { number: 'asc' as const },
    include: {
      seller: { select: { id: true, userId: true, farmName: true, slug: true, logoUrl: true, region: true, district: true } },
      items: { include: { review: { select: { id: true, rating: true } } } },
      delivery: { include: { history: { orderBy: { createdAt: 'asc' as const } } } },
      statusHistory: { orderBy: { createdAt: 'asc' as const } },
      refunds: true,
    },
  },
  payments: { orderBy: { createdAt: 'desc' as const }, select: { id: true, provider: true, method: true, status: true, amount: true, refundedAmount: true, paidAt: true, createdAt: true } },
  statusHistory: { where: { sellerOrderId: null }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

r.get(
  '/:id',
  ah(async (req, res) => {
    const o = await prisma.order.findUnique({ where: { id: req.params.id }, include: { ...orderInclude, buyer: { select: { id: true, fullName: true } } } });
    // Egalik tekshiruvi: xaridor, admin yoki buyurtmada qatnashgan sotuvchi (faqat o'z qismi)
    if (!o) throw Errors.notFound('Buyurtma');
    const isBuyer = o.buyerId === req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const sellerPart = req.user!.sellerId ? o.sellerOrders.filter((s) => s.sellerId === req.user!.sellerId) : [];
    if (!isBuyer && !isAdmin && !sellerPart.length) throw Errors.notFound('Buyurtma');
    const view = isBuyer || isAdmin ? o : { ...o, sellerOrders: sellerPart, payments: [] };
    const pending = o.payments.find((p) => ['pending'].includes(p.status));
    ok(res, {
      ...view,
      viewer: isAdmin ? 'admin' : isBuyer ? 'buyer' : 'seller',
      canCancel: isBuyer && o.sellerOrders.some((s) => allowedTransitions('BUYER', s.status).includes('cancelled')),
      payAction: isBuyer && pending && o.paymentMethod !== 'cash' && o.status !== 'cancelled' ? { paymentId: pending.id, checkoutUrl: checkoutUrl({ ...pending }) } : null,
    });
  }),
);

/** Xaridor bekor qiladi: bekor qilish mumkin bo'lgan barcha qismlar (pending/confirmed) */
r.post(
  '/:id/cancel',
  validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const o = await prisma.order.findFirst({ where: { id: req.params.id, buyerId: req.user!.id }, include: { sellerOrders: { include: { seller: { select: { userId: true } } } } } });
    if (!o) throw Errors.notFound('Buyurtma');
    const cancellable = o.sellerOrders.filter((s) => allowedTransitions('BUYER', s.status).includes('cancelled'));
    if (!cancellable.length) throw new AppError(409, 'CANNOT_CANCEL', "Buyurtma tayyorlanayotgani sababli bekor qilib bo'lmaydi. Sotuvchi bilan bog'laning");
    await prisma.$transaction(async (tx) => {
      for (const so of cancellable) await transitionSellerOrder(tx, so.id, 'cancelled', { id: req.user!.id, role: 'BUYER' }, { reason: req.body.reason });
    });
    for (const so of cancellable) {
      void notify({ userId: so.seller.userId, type: 'order.cancelled', key: 'order.cancelled.seller', params: { number: so.number }, link: `/seller/orders/${so.id}` });
      emitToUser(so.seller.userId, { type: 'order_update', payload: { sellerOrderId: so.id, status: 'cancelled' } });
    }
    ok(res, { cancelled: cancellable.length });
  }),
);

/** Xaridor qabul qilganini tasdiqlaydi (shipped → delivered) */
r.post(
  '/seller-orders/:soId/receive',
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findFirst({ where: { id: req.params.soId, order: { buyerId: req.user!.id } }, include: { seller: { select: { userId: true } } } });
    if (!so) throw Errors.notFound('Buyurtma');
    await prisma.$transaction((tx) => transitionSellerOrder(tx, so.id, 'delivered', { id: req.user!.id, role: 'BUYER' }, { note: 'Xaridor qabul qildi' }));
    void notify({ userId: so.seller.userId, type: 'order.status', key: 'order.status', params: { number: so.number, status: 'delivered' }, link: `/seller/orders/${so.id}` });
    ok(res, { status: 'delivered' });
  }),
);

// ───────── Sotuvchi ─────────
const sellerListQ = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().max(60).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

r.get(
  '/seller/list',
  requireSeller,
  validate({ query: sellerListQ }),
  ah(async (req, res) => {
    const f = q(req, sellerListQ);
    const { skip, take, page, limit } = pageParams(f.page, f.limit ?? 20);
    const where: Prisma.SellerOrderWhereInput = {
      sellerId: sellerId(req),
      ...(f.status ? { status: f.status } : {}),
      ...(f.q ? { OR: [{ number: { contains: f.q, mode: 'insensitive' } }, { order: { recipientName: { contains: f.q, mode: 'insensitive' } } }] } : {}),
      // To'lanmagan onlayn buyurtmalar sotuvchiga ko'rsatilmaydi
      order: { OR: [{ paymentMethod: 'cash' }, { paymentStatus: { in: ['paid', 'refunded', 'partially_refunded'] } }] },
    };
    const [rows, total, counts] = await Promise.all([
      prisma.sellerOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: { select: { productName: true, quantity: true, unit: true, imageUrl: true } },
          order: { select: { id: true, orderNumber: true, recipientName: true, region: true, district: true, deliveryDate: true, deliverySlot: true, paymentMethod: true, paymentStatus: true } },
          delivery: { select: { status: true, courierName: true } },
        },
      }),
      prisma.sellerOrder.count({ where }),
      prisma.sellerOrder.groupBy({ by: ['status'], where: { sellerId: sellerId(req), order: where.order }, _count: { _all: true } }),
    ]);
    ok(res, rows, { ...pageMeta(total, page, limit), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) });
  }),
);

r.get(
  '/seller/:soId',
  requireSeller,
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findFirst({
      where: { id: req.params.soId, sellerId: sellerId(req) },
      include: {
        items: true,
        order: {
          select: {
            id: true, orderNumber: true, buyerId: true, recipientName: true, contactPhone: true, region: true, district: true, addressLine: true,
            deliveryDate: true, deliverySlot: true, deliveryNotes: true, paymentMethod: true, paymentStatus: true, createdAt: true,
          },
        },
        delivery: { include: { history: { orderBy: { createdAt: 'asc' } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!so) throw Errors.notFound('Buyurtma');
    ok(res, { ...so, allowed: allowedTransitions('SELLER', so.status) });
  }),
);

const transitionSchema = z.object({
  status: z.enum(STATUSES),
  note: z.string().max(300).optional().nullable(),
  reason: z.string().max(300).optional().nullable(),
  courierName: z.string().max(100).optional().nullable(),
  courierPhone: z.string().max(20).optional().nullable(),
});

r.post(
  '/seller/:soId/status',
  requireSeller,
  validate({ body: transitionSchema }),
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findFirst({ where: { id: req.params.soId, sellerId: sellerId(req) }, include: { order: { select: { buyerId: true } } } });
    if (!so) throw Errors.notFound('Buyurtma');
    const to = req.body.status as OrderStatus;
    if (to === 'cancelled' && !req.body.reason) throw Errors.validation([{ path: 'reason', message: 'Rad etish sababini kiriting' }]);
    const courierPhone = req.body.courierPhone ? normalizePhone(req.body.courierPhone) ?? req.body.courierPhone : null;
    await prisma.$transaction((tx) =>
      transitionSellerOrder(tx, so.id, to, { id: req.user!.id, role: 'SELLER' }, { ...req.body, courierPhone }),
    );
    void notify({
      userId: so.order.buyerId,
      type: to === 'shipped' ? 'delivery.update' : 'order.status',
      key: 'order.status',
      params: { number: so.number, status: to },
      link: `/account/orders/${so.orderId}`,
      external: ['confirmed', 'shipped', 'cancelled'].includes(to),
    });
    emitToUser(so.order.buyerId, { type: 'order_update', payload: { orderId: so.orderId, sellerOrderId: so.id, status: to } });
    ok(res, { status: to });
  }),
);

/** Yetkazish ma'lumotlarini yangilash (kuryer, izoh). GPS kuzatuv yo'q — faqat holatlar va izohlar. */
r.patch(
  '/seller/:soId/delivery',
  requireSeller,
  validate({
    body: z.object({
      courierName: z.string().max(100).optional().nullable(),
      courierPhone: z.string().max(20).optional().nullable(),
      trackingNote: z.string().max(300).optional().nullable(),
      status: z.enum(['picked_up', 'in_transit', 'failed']).optional(),
    }),
  }),
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findFirst({ where: { id: req.params.soId, sellerId: sellerId(req) }, include: { delivery: true, order: { select: { buyerId: true } } } });
    if (!so?.delivery) throw Errors.notFound('Yetkazish');
    if (req.body.status && !['ready_for_delivery', 'shipped'].includes(so.status)) throw Errors.badRequest("Bu holatda yetkazish holatini o'zgartirib bo'lmaydi");
    const d = await prisma.$transaction(async (tx) => {
      const upd = await tx.delivery.update({
        where: { id: so.delivery!.id },
        data: {
          courierName: req.body.courierName ?? so.delivery!.courierName,
          courierPhone: req.body.courierPhone ? normalizePhone(req.body.courierPhone) ?? req.body.courierPhone : so.delivery!.courierPhone,
          trackingNote: req.body.trackingNote ?? so.delivery!.trackingNote,
          ...(req.body.status ? { status: req.body.status } : {}),
        },
      });
      if (req.body.status || req.body.trackingNote) {
        await tx.deliveryStatusHistory.create({ data: { deliveryId: upd.id, status: upd.status, note: req.body.trackingNote ?? null, actorId: req.user!.id } });
      }
      return upd;
    });
    emitToUser(so.order.buyerId, { type: 'order_update', payload: { orderId: so.orderId, delivery: d.status } });
    ok(res, d);
  }),
);

export default r;
export const _schemas = { checkoutSchema };
