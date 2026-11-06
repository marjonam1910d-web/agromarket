import { Prisma } from '@prisma/client';

/** Pul hisob-kitoblari faqat Decimal orqali (float ishlatilmaydi). */
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const ZERO = new Prisma.Decimal(0);

/** UZS — butun so'mgacha yaxlitlash */
export const roundSom = (v: Prisma.Decimal) => v.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

export const sum = (xs: Prisma.Decimal[]) => xs.reduce((a, b) => a.add(b), ZERO);

export const min = (a: Prisma.Decimal, b: Prisma.Decimal) => (a.lessThan(b) ? a : b);

/** Summani ulushlarga proporsional taqsimlash; qoldiq oxirgi ulushga beriladi */
export function allocate(total: Prisma.Decimal, weights: Prisma.Decimal[]): Prisma.Decimal[] {
  const w = sum(weights);
  if (w.isZero()) return weights.map(() => ZERO);
  let used = ZERO;
  return weights.map((wi, i) => {
    if (i === weights.length - 1) return total.sub(used);
    const part = roundSom(total.mul(wi).div(w));
    used = used.add(part);
    return part;
  });
}
