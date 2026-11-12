import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { notify } from '../notifications/notifications.service';

/**
 * Hamyon (ledger) — har bir pul harakati alohida yozuv:
 *  - onlayn to'langan buyurtma yetkazilganda: +sellerPayout (komissiya chegirilgan) fermer hamyoniga
 *  - naqd buyurtma yetkazilganda: fermer pulni o'zi oldi → −komissiya (platforma ulushi) hamyondan
 *  - yechib olish: −summa (pending → completed/failed)
 * (kind, refId) unikal — bitta buyurtma uchun ikki marta yozilmaydi.
 */
export async function settleSellerWallet(
  tx: Tx,
  so: { id: string; number: string; sellerId: string; sellerPayout: Prisma.Decimal; commissionAmount: Prisma.Decimal; deliveryFee?: Prisma.Decimal; order: { paymentMethod: string } },
) {
  const seller = await tx.sellerProfile.findUnique({ where: { id: so.sellerId }, select: { userId: true } });
  if (!seller) return;
  await settlePartnerShare(tx, so, seller.userId);
  if (so.order.paymentMethod === 'cash') {
    if (so.commissionAmount.lte(0)) return;
    await tx.walletTransaction.createMany({
      data: [{ userId: seller.userId, kind: 'commission', amount: so.commissionAmount.neg(), refType: 'SellerOrder', refId: so.id, note: `${so.number}: naqd buyurtma komissiyasi`, completedAt: new Date() }],
      skipDuplicates: true,
    });
    return;
  }
  const r = await tx.walletTransaction.createMany({
    data: [{ userId: seller.userId, kind: 'order_payout', amount: so.sellerPayout, refType: 'SellerOrder', refId: so.id, note: so.number, completedAt: new Date() }],
    skipDuplicates: true,
  });
  if (r.count) void notify({ userId: seller.userId, type: 'wallet', key: 'wallet.credited', params: { number: so.number, amount: so.sellerPayout.toFixed(0) }, link: '/seller/wallet' });
}

/** Yetkazish hamkorligi faol bo'lsa: yetkazish to'lovining kelishilgan foizi platformaga (har buyurtma uchun bir marta) */
export async function settlePartnerShare(tx: Tx, so: { id: string; number: string; sellerId: string; deliveryFee?: Prisma.Decimal }, userId: string) {
  const fee = so.deliveryFee ?? (await tx.sellerOrder.findUnique({ where: { id: so.id }, select: { deliveryFee: true } }))?.deliveryFee;
  if (!fee || fee.lte(0)) return;
  const p = await tx.partnership.findFirst({ where: { sellerId: so.sellerId, status: 'active' }, orderBy: { startedAt: 'desc' } });
  if (!p) return;
  const share = fee.mul(p.deliverySharePercent).div(100).toDecimalPlaces(0);
  if (share.lte(0)) return;
  await tx.walletTransaction.createMany({
    data: [{ userId, kind: 'partner_share', amount: share.neg(), refType: 'SellerOrder', refId: so.id, note: `${so.number}: yetkazish hamkorligi ${p.deliverySharePercent.toString()}% (${p.number})`, completedAt: new Date() }],
    skipDuplicates: true,
  });
}

/** available = yakunlangan yozuvlar + kutilayotgan yechib olishlar (ular darhol band qilinadi) */
export async function walletBalance(userId: string, db: Tx | typeof prisma = prisma) {
  const [done, pendingOut, earned] = await Promise.all([
    db.walletTransaction.aggregate({ where: { userId, status: 'completed' }, _sum: { amount: true } }),
    db.walletTransaction.aggregate({ where: { userId, status: 'pending', amount: { lt: 0 } }, _sum: { amount: true } }),
    db.walletTransaction.aggregate({ where: { userId, status: 'completed', kind: 'order_payout' }, _sum: { amount: true } }),
  ]);
  const completed = done._sum.amount ?? new Prisma.Decimal(0);
  const pending = pendingOut._sum.amount ?? new Prisma.Decimal(0);
  return { available: completed.add(pending), pendingWithdrawals: pending.neg(), totalEarned: earned._sum.amount ?? new Prisma.Decimal(0) };
}
