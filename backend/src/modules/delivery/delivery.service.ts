import type { DeliveryZone, Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { D, roundSom, ZERO } from '../../common/money';

/**
 * Yetkazish narxi qoidasi (sotuvchi bo'yicha):
 *   fee = baseFee + perKgFee × og'irlik(kg);  subtotal >= freeFromAmount bo'lsa — bepul.
 * Zona tanlash: avval aniq tuman, keyin butun viloyat (district = null).
 * Xarita API bo'lmagani uchun masofa o'rniga viloyat/tuman asosidagi tariflar ishlatiladi —
 * bu ishlaydigan fallback; masofaga asoslangan narx uchun `DISTANCE_PROVIDER` qo'shilishi mumkin.
 */
export async function findZone(db: Tx | typeof prisma, sellerId: string, region: string, district: string): Promise<DeliveryZone | null> {
  const zones = await db.deliveryZone.findMany({ where: { sellerId, region, isActive: true } });
  return zones.find((z) => z.district === district) ?? zones.find((z) => z.district === null) ?? null;
}

export function calcFee(zone: DeliveryZone, subtotal: Prisma.Decimal, weightKg: Prisma.Decimal) {
  if (zone.freeFromAmount && subtotal.greaterThanOrEqualTo(zone.freeFromAmount)) return ZERO;
  return roundSom(zone.baseFee.add(zone.perKgFee.mul(weightKg)));
}

export function estimateDays(zone: DeliveryZone) {
  return { minDays: zone.minDays, maxDays: zone.maxDays };
}

export const D0 = D(0);
