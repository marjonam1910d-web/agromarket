import type { Prisma, Coupon } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { AppError } from '../../common/errors';
import { allocate, D, roundSom, sum, ZERO, min } from '../../common/money';
import { activePromotionsInclude, finalUnitPrice } from '../products/pricing';
import { calcFee, findZone } from '../delivery/delivery.service';

type Db = Tx | typeof prisma;

export interface QuoteOptions {
  region?: string;
  district?: string;
  couponCode?: string | null;
}

export type ItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'BELOW_MIN_QTY';

export async function loadCartItems(db: Db, userId: string) {
  const now = new Date();
  const cart = await db.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          inventory: true,
          promotions: activePromotionsInclude(now),
          seller: { select: { id: true, userId: true, farmName: true, slug: true, verificationStatus: true, user: { select: { status: true } } } },
        },
      },
    },
  });
  return { cart, items };
}

async function couponFor(db: Db, code: string, userId: string): Promise<Coupon> {
  const c = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!c || !c.isActive || c.startsAt > now || c.endsAt < now) throw new AppError(400, 'COUPON_INVALID', 'Kupon yaroqsiz yoki muddati tugagan');
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) throw new AppError(400, 'COUPON_EXHAUSTED', 'Kupondan foydalanish limiti tugagan');
  const used = await db.couponRedemption.count({ where: { couponId: c.id, userId } });
  if (used >= c.perUserLimit) throw new AppError(400, 'COUPON_USED', 'Siz bu kupondan allaqachon foydalangansiz');
  return c;
}

/**
 * Savatcha hisob-kitobi — checkout ham aynan shu funksiyani tranzaksiya ichida chaqiradi.
 * Natija sotuvchilar bo'yicha guruhlangan (har biri alohida SellerOrder bo'ladi).
 */
export async function buildQuote(db: Db, userId: string, opts: QuoteOptions = {}) {
  const { cart, items } = await loadCartItems(db, userId);
  const now = new Date();

  const lines = items.map((ci) => {
    const p = ci.product;
    const stock = p.inventory?.quantity ?? ZERO;
    let issue: ItemIssue | null = null;
    if (p.deletedAt || !['active', 'out_of_stock'].includes(p.status) || p.seller.verificationStatus !== 'APPROVED' || p.seller.user.status !== 'ACTIVE') issue = 'UNAVAILABLE';
    else if (stock.lessThanOrEqualTo(0) || p.status === 'out_of_stock') issue = 'OUT_OF_STOCK';
    else if (ci.quantity.greaterThan(stock)) issue = 'INSUFFICIENT_STOCK';
    else if (ci.quantity.lessThan(p.minOrderQty)) issue = 'BELOW_MIN_QTY';
    const unitPrice = finalUnitPrice(p, now);
    return {
      id: ci.id,
      productId: p.id,
      name: p.name,
      slug: p.slug,
      unit: p.unit,
      image: p.images[0]?.thumbUrl ?? p.images[0]?.url ?? null,
      quantity: ci.quantity,
      minOrderQty: p.minOrderQty,
      stock,
      basePrice: p.price,
      unitPrice,
      lineTotal: roundSom(unitPrice.mul(ci.quantity)),
      weightKg: p.weightPerUnitKg.mul(ci.quantity),
      issue,
      sellerId: p.seller.id,
      seller: { id: p.seller.id, userId: p.seller.userId, farmName: p.seller.farmName, slug: p.seller.slug },
    };
  });

  const sellerIds = [...new Set(lines.map((l) => l.sellerId))];
  const groups = await Promise.all(
    sellerIds.map(async (sid) => {
      const gl = lines.filter((l) => l.sellerId === sid);
      const valid = gl.filter((l) => !l.issue);
      const subtotal = sum(valid.map((l) => l.lineTotal));
      const weightKg = sum(valid.map((l) => l.weightKg));
      let deliveryFee: Prisma.Decimal | null = null;
      let deliverable: boolean | null = null;
      let eta: { minDays: number; maxDays: number } | null = null;
      if (opts.region && opts.district && valid.length) {
        const zone = await findZone(db, sid, opts.region, opts.district);
        deliverable = Boolean(zone);
        if (zone) {
          deliveryFee = calcFee(zone, subtotal, weightKg);
          eta = { minDays: zone.minDays, maxDays: zone.maxDays };
        }
      }
      return { seller: gl[0].seller, items: gl, subtotal, weightKg, deliveryFee, deliverable, eta, discount: ZERO };
    }),
  );

  // Kupon: sotuvchi kuponi — faqat o'sha sotuvchi summasiga; platforma kuponi — proporsional taqsimlanadi
  let coupon: Coupon | null = null;
  let couponError: string | null = null;
  const code = opts.couponCode ?? cart.couponCode;
  if (code) {
    try {
      coupon = await couponFor(db, code, userId);
      const eligible = groups.filter((g) => !coupon!.sellerId || g.seller.id === coupon!.sellerId);
      const base = sum(eligible.map((g) => g.subtotal));
      if (base.isZero()) throw new AppError(400, 'COUPON_NOT_APPLICABLE', "Kupon savatchadagi mahsulotlarga taalluqli emas");
      if (base.lessThan(coupon.minOrderAmount)) throw new AppError(400, 'COUPON_MIN_AMOUNT', `Kupon uchun minimal summa: ${coupon.minOrderAmount.toFixed(0)} so'm`);
      let disc = coupon.type === 'percent' ? roundSom(base.mul(coupon.value).div(100)) : coupon.value;
      if (coupon.maxDiscount) disc = min(disc, coupon.maxDiscount);
      disc = min(disc, base);
      const parts = allocate(disc, eligible.map((g) => g.subtotal));
      eligible.forEach((g, i) => (g.discount = parts[i]));
    } catch (e) {
      coupon = null;
      couponError = e instanceof AppError ? e.message : 'Kupon xatosi';
    }
  }

  const subtotal = sum(groups.map((g) => g.subtotal));
  const discountTotal = sum(groups.map((g) => g.discount));
  const deliveryKnown = groups.every((g) => g.deliveryFee !== null || !g.items.some((l) => !l.issue));
  const deliveryFee = sum(groups.map((g) => g.deliveryFee ?? ZERO));
  return {
    cartId: cart.id,
    groups: groups.map((g) => ({ ...g, total: g.subtotal.sub(g.discount).add(g.deliveryFee ?? ZERO) })),
    itemCount: lines.length,
    hasIssues: lines.some((l) => l.issue),
    coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
    couponError,
    subtotal,
    discountTotal,
    deliveryFee,
    deliveryKnown: Boolean(opts.region) && deliveryKnown,
    total: subtotal.sub(discountTotal).add(deliveryFee),
  };
}

export type Quote = Awaited<ReturnType<typeof buildQuote>>;
export const DZ = D;
