import crypto from 'node:crypto';
import type { PaymentMethod, PaymentProvider } from '@prisma/client';
import { prisma, Prisma } from '../../lib/prisma';
import { AppError, Errors } from '../../common/errors';
import { D, roundSom, ZERO } from '../../common/money';
import { addDays, tashkentToday } from '../../common/utils';
import { getSetting } from '../../common/audit';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { buildQuote } from '../cart/cart.service';
import { syncStockStatus } from '../products/products.service';
import { resolveProvider } from '../payments/providers';
import { notify } from '../notifications/notifications.service';

export interface CheckoutAddress {
  recipientName: string;
  phone: string;
  region: string;
  district: string;
  street: string;
  landmark?: string | null;
}

export interface CheckoutInput {
  address: CheckoutAddress;
  deliveryDate: string; // YYYY-MM-DD
  deliverySlot: string;
  deliveryNotes?: string | null;
  paymentMethod: PaymentMethod;
  idempotencyKey?: string | null;
}

function orderNumber() {
  const d = tashkentToday().slice(2).replace(/-/g, '');
  return `AM${d}${crypto.randomInt(10000, 99999)}`;
}

/**
 * Checkout — bitta DB tranzaksiyasi:
 *  1) savatcha qayta hisoblanadi (narx/qoldiq/yetkazish serverda),
 *  2) har bir mahsulot qoldig'i SHARTLI atomik UPDATE bilan kamaytiriladi
 *     (`quantity >= qty` sharti — ikki xaridor bir vaqtda oxirgi zaxirani ololmaydi),
 *  3) ota buyurtma + sotuvchi bo'yicha ichki buyurtmalar + yetkazish yozuvlari + to'lov yaratiladi.
 * Biror qadam xato bersa — hammasi bekor qilinadi (rollback).
 */
export async function checkout(userId: string, input: CheckoutInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: true } });
    if (existing) {
      if (existing.buyerId !== userId) throw Errors.conflict('IDEMPOTENCY_CONFLICT', 'Takroriy so\'rov kaliti');
      return { order: existing, payment: existing.payments[0] ?? null, replay: true };
    }
  }

  const a = input.address;
  if (!isValidRegion(a.region) || !isValidDistrict(a.region, a.district)) throw Errors.badRequest("Manzil (viloyat/tuman) noto'g'ri");

  const slots = await getSetting('delivery.slots');
  if (!(slots as readonly string[]).includes(input.deliverySlot)) throw Errors.badRequest("Yetkazish vaqti noto'g'ri");
  const maxAhead = await getSetting('delivery.maxDaysAhead');
  const today = tashkentToday();
  if (input.deliveryDate < today || input.deliveryDate > addDays(today, Number(maxAhead))) {
    throw new AppError(422, 'BAD_DELIVERY_DATE', `Yetkazish sanasi bugundan ${maxAhead} kungacha bo'lishi kerak`);
  }
  const commissionPercent = D(Number(await getSetting('commission.percent')));
  const provider: PaymentProvider = input.paymentMethod === 'cash' ? 'cash' : resolveProvider(input.paymentMethod);

  const result = await prisma.$transaction(
    async (tx) => {
      const quote = await buildQuote(tx, userId, { region: a.region, district: a.district });
      if (!quote.itemCount) throw new AppError(400, 'CART_EMPTY', "Savatcha bo'sh");
      if (quote.hasIssues) {
        const issues = quote.groups.flatMap((g) => g.items.filter((i) => i.issue).map((i) => ({ productId: i.productId, name: i.name, issue: i.issue, available: i.stock })));
        throw new AppError(409, 'CART_ISSUES', "Savatchadagi ba'zi mahsulotlar mavjud emas yoki qoldiq yetarli emas", issues);
      }
      const notDeliverable = quote.groups.filter((g) => !g.deliverable);
      if (notDeliverable.length) {
        throw new AppError(409, 'NOT_DELIVERABLE', "Ba'zi sotuvchilar tanlangan hududga yetkazib bermaydi", notDeliverable.map((g) => g.seller.farmName));
      }
      for (const g of quote.groups) {
        if (g.eta && input.deliveryDate < addDays(today, g.eta.minDays)) {
          throw new AppError(422, 'BAD_DELIVERY_DATE', `"${g.seller.farmName}" eng erta ${addDays(today, g.eta.minDays)} sanada yetkazadi`);
        }
      }

      // ── Zaxirani atomik kamaytirish (overselling'dan himoya) ──
      for (const g of quote.groups) {
        for (const it of g.items) {
          const updated = await tx.productInventory.updateMany({
            where: { productId: it.productId, quantity: { gte: it.quantity } },
            data: { quantity: { decrement: it.quantity } },
          });
          if (updated.count !== 1) {
            throw new AppError(409, 'INSUFFICIENT_STOCK', `"${it.name}" uchun qoldiq yetarli emas — boshqa xaridor sotib olgan bo'lishi mumkin`, [{ productId: it.productId, name: it.name }]);
          }
          await syncStockStatus(tx, it.productId);
        }
      }

      // ── Kupon: limitni atomik oshirish ──
      let couponId: string | null = null;
      if (quote.coupon) {
        const c = await tx.coupon.findUniqueOrThrow({ where: { code: quote.coupon.code } });
        const n = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE id = ${c.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
        if (n !== 1) throw new AppError(409, 'COUPON_EXHAUSTED', 'Kupondan foydalanish limiti tugagan');
        couponId = c.id;
      }

      const number = orderNumber();
      const order = await tx.order.create({
        data: {
          orderNumber: number,
          buyerId: userId,
          paymentMethod: input.paymentMethod,
          subtotal: quote.subtotal,
          deliveryFee: quote.deliveryFee,
          discountTotal: quote.discountTotal,
          total: quote.total,
          couponId,
          recipientName: a.recipientName,
          contactPhone: a.phone,
          region: a.region,
          district: a.district,
          addressLine: [a.street, a.landmark].filter(Boolean).join(', '),
          deliveryDate: new Date(`${input.deliveryDate}T00:00:00Z`),
          deliverySlot: input.deliverySlot,
          deliveryNotes: input.deliveryNotes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          statusHistory: { create: { toStatus: 'pending', actorId: userId, note: 'created' } },
        },
      });
      if (couponId) await tx.couponRedemption.create({ data: { couponId, userId, orderId: order.id } });

      const sellerOrders = [];
      let idx = 1;
      for (const g of quote.groups) {
        const fee = g.deliveryFee ?? ZERO;
        const goods = g.subtotal.sub(g.discount);
        const commission = roundSom(goods.mul(commissionPercent).div(100));
        const total = goods.add(fee);
        const so = await tx.sellerOrder.create({
          data: {
            orderId: order.id,
            sellerId: g.seller.id,
            number: `${number}-${idx++}`,
            subtotal: g.subtotal,
            deliveryFee: fee,
            discount: g.discount,
            total,
            commissionRate: commissionPercent,
            commissionAmount: commission,
            sellerPayout: total.sub(commission),
            items: {
              create: g.items.map((it) => ({
                orderId: order.id,
                productId: it.productId,
                productName: it.name,
                imageUrl: it.image,
                unit: it.unit,
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
              })),
            },
            delivery: {
              create: {
                fee,
                weightKg: g.weightKg,
                scheduledDate: new Date(`${input.deliveryDate}T00:00:00Z`),
                slot: input.deliverySlot,
                history: { create: { status: 'pending', note: 'created' } },
              },
            },
            statusHistory: { create: { orderId: order.id, toStatus: 'pending', actorId: userId } },
          },
        });
        sellerOrders.push({ ...so, sellerUserId: g.seller.userId });
      }

      const payment = await tx.payment.create({
        data: { orderId: order.id, provider, method: input.paymentMethod, amount: quote.total, status: 'pending' },
      });

      await tx.cartItem.deleteMany({ where: { cartId: quote.cartId } });
      await tx.cart.update({ where: { id: quote.cartId }, data: { couponCode: null } });
      return { order, sellerOrders, payment };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000, maxWait: 10_000 },
  );

  // Tranzaksiyadan keyin — bildirishnomalar (xato bo'lsa ham buyurtma saqlanib qoladi)
  void notify({ userId, type: 'order.new', key: 'order.placed.buyer', params: { number: result.order.orderNumber }, link: `/account/orders/${result.order.id}` });
  for (const so of result.sellerOrders) {
    // Onlayn to'lovda sotuvchi to'lov tasdiqlangach xabardor qilinadi
    if (input.paymentMethod === 'cash') {
      void notify({
        userId: so.sellerUserId,
        type: 'order.new',
        key: 'order.new.seller',
        params: { number: so.number, total: so.total.toFixed(0) },
        link: `/seller/orders/${so.id}`,
        external: true,
      });
    }
  }
  return { order: result.order, payment: result.payment, replay: false };
}

/** Sotuvchilarga "yangi buyurtma" xabari (onlayn to'lov tasdiqlangach chaqiriladi) */
export async function notifySellersNewOrder(orderId: string) {
  const sos = await prisma.sellerOrder.findMany({ where: { orderId }, include: { seller: { select: { userId: true } } } });
  for (const so of sos) {
    void notify({
      userId: so.seller.userId,
      type: 'order.new',
      key: 'order.new.seller',
      params: { number: so.number, total: so.total.toFixed(0) },
      link: `/seller/orders/${so.id}`,
      external: true,
    });
  }
}

export const _test = { orderNumber };
