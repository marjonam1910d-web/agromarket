import type { Prisma, ProductStatus } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { activePromotionsInclude, finalUnitPrice } from './pricing';

export const productCardSelect = (now = new Date()) =>
  ({
    id: true,
    name: true,
    slug: true,
    price: true,
    discountPrice: true,
    effectivePrice: true,
    unit: true,
    minOrderQty: true,
    region: true,
    district: true,
    isSeasonal: true,
    seasonLabel: true,
    isOrganic: true,
    status: true,
    ratingAvg: true,
    ratingCount: true,
    soldCount: true,
    createdAt: true,
    images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, thumbUrl: true } },
    inventory: { select: { quantity: true } },
    seller: { select: { id: true, farmName: true, slug: true, verificationStatus: true, ratingAvg: true } },
    category: { select: { id: true, slug: true, nameUz: true, nameRu: true, nameEn: true } },
    promotions: activePromotionsInclude(now),
  }) satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof productCardSelect> }>;

export function toCard(p: CardRow, now = new Date()) {
  const finalPrice = finalUnitPrice(p, now);
  const { promotions, inventory, images, ...rest } = p;
  return {
    ...rest,
    finalPrice,
    hasDiscount: finalPrice.lessThan(p.price),
    discountPercent: finalPrice.lessThan(p.price) ? Math.round((1 - finalPrice.toNumber() / p.price.toNumber()) * 100) : 0,
    stock: inventory?.quantity ?? 0,
    inStock: Boolean(inventory && inventory.quantity.greaterThanOrEqualTo(p.minOrderQty)) && p.status === 'active',
    image: images[0] ?? null,
    promotionPercent: promotions.reduce((m, x) => Math.max(m, x.discountPercent), 0),
  };
}

/**
 * Qoldiqqa qarab holatni moslashtiradi: active ↔ out_of_stock.
 * Moderatsiya holatlari (draft/pending_review/rejected/inactive) o'zgartirilmaydi.
 */
export async function syncStockStatus(tx: Tx, productId: string) {
  const p = await tx.product.findUnique({ where: { id: productId }, select: { status: true, minOrderQty: true, inventory: true } });
  if (!p) return;
  const qty = p.inventory?.quantity;
  if (!qty) return;
  let next: ProductStatus | null = null;
  if (p.status === 'active' && qty.lessThan(p.minOrderQty)) next = 'out_of_stock';
  if (p.status === 'out_of_stock' && qty.greaterThanOrEqualTo(p.minOrderQty)) next = 'active';
  if (next) await tx.product.update({ where: { id: productId }, data: { status: next } });
}

export async function getSellerUserId(sellerProfileId: string) {
  const s = await prisma.sellerProfile.findUnique({ where: { id: sellerProfileId }, select: { userId: true } });
  return s?.userId ?? null;
}
