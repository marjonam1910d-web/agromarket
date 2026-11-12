import type { Request } from 'express';
import { prisma, type Tx } from '../lib/prisma';

export async function audit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta?: Record<string, unknown>,
  tx?: Tx,
) {
  const db = tx ?? prisma;
  await db.auditLog.create({
    data: {
      actorId: req?.user?.id ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      meta: (meta ?? undefined) as object | undefined,
      ip: req?.ip ?? null,
    },
  });
}

/** Tizim sozlamalari (komissiya, avto-tasdiqlash va h.k.) */
export const SETTING_DEFAULTS = {
  'commission.percent': 5,
  'products.autoApprove': false,
  'orders.buyerCancelStatuses': ['pending', 'confirmed'],
  'delivery.slots': ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
  'delivery.maxDaysAhead': 14,
  'reviews.autoHideReports': 5,
  'platform.supportPhone': '+998 71 200 00 00',
  'partner.deliverySharePercent': 10,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return (s?.value as (typeof SETTING_DEFAULTS)[K]) ?? SETTING_DEFAULTS[key];
}
