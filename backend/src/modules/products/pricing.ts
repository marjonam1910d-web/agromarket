import type { Prisma } from '@prisma/client';
import { D, roundSom, min } from '../../common/money';

type PriceInput = {
  price: Prisma.Decimal;
  discountPrice: Prisma.Decimal | null;
  promotions?: { discountPercent: number; startsAt: Date; endsAt: Date; isActive: boolean }[];
};

/**
 * Yakuniy narx = min(chegirma narxi yoki asosiy narx, faol aksiya bo'yicha narx).
 * Savatcha, checkout va katalog bir xil funksiyani ishlatadi — narx nomuvofiqligi bo'lmaydi.
 */
export function finalUnitPrice(p: PriceInput, now = new Date()): Prisma.Decimal {
  let best = p.discountPrice && p.discountPrice.lessThan(p.price) ? p.discountPrice : p.price;
  const promo = (p.promotions ?? [])
    .filter((x) => x.isActive && x.startsAt <= now && x.endsAt >= now)
    .reduce((m, x) => Math.max(m, x.discountPercent), 0);
  if (promo > 0) best = min(best, roundSom(p.price.mul(D(100 - promo)).div(100)));
  return best;
}

export function effectivePrice(price: Prisma.Decimal.Value, discountPrice?: Prisma.Decimal.Value | null) {
  const p = D(price);
  if (discountPrice === null || discountPrice === undefined) return p;
  const dp = D(discountPrice);
  return dp.lessThan(p) ? dp : p;
}

export const activePromotionsInclude = (now = new Date()) => ({
  where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
  select: { discountPercent: true, startsAt: true, endsAt: true, isActive: true },
});

/** Birlik bo'yicha og'irlik (kg) — yetkazish narxini hisoblash uchun standart qiymatlar */
export const DEFAULT_UNIT_WEIGHT: Record<string, number> = { kg: 1, g: 0.001, tonna: 1000, litr: 1, dona: 0.3, qop: 50 };
