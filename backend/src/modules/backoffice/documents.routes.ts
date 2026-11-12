import crypto from 'node:crypto';
import { Router } from 'express';
import { ah, ok } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { newSealCode } from '../contracts/contracts.service';

/** Chop etiladigan hujjatlar: hisob-faktura (fermer muhri bilan) va ma'muriy chora dalolatnomasi */
const r = Router();
r.use(authenticate);

/** Platforma muhri (ma'muriyat) — barqaror kod */
export const platformSeal = () => ({
  code: `AM-${crypto.createHash('sha256').update(`platform|${env.JWT_REFRESH_SECRET}`).digest('hex').slice(0, 10).toUpperCase().replace(/(.{5})/, '$1-')}`,
  title: "AgroMarket ma'muriyati",
  subtitle: 'Toshkent',
  color: '#1E3A8A',
});

/** Fermer muhri yo'q bo'lsa — xo'jalik nomi bilan avtomatik yaratiladi (hujjatlarda ishlatish uchun) */
export async function ensureSeal(userId: string, title: string, subtitle: string) {
  const s = await prisma.userSeal.findUnique({ where: { userId } });
  if (s) return s;
  try {
    return await prisma.userSeal.create({ data: { userId, code: newSealCode(), title, subtitle, color: '#1F4D36' } });
  } catch {
    return prisma.userSeal.findUniqueOrThrow({ where: { userId } });
  }
}

r.get(
  '/invoice/:sellerOrderId',
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findUnique({
      where: { id: req.params.sellerOrderId },
      include: {
        items: true,
        delivery: { select: { courierName: true, courierPhone: true, deliveredAt: true } },
        seller: { include: { user: { select: { id: true, fullName: true, phone: true, email: true } } } },
        order: { include: { buyer: { select: { id: true, fullName: true, phone: true, email: true, buyerProfile: { select: { companyName: true } } } }, payments: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      },
    });
    if (!so) throw Errors.notFound('Buyurtma');
    const uid = req.user!.id;
    const staff = await prisma.farmStaff.findFirst({ where: { sellerId: so.sellerId, userId: uid, status: 'active' }, select: { id: true } });
    if (req.user!.role !== 'ADMIN' && so.order.buyerId !== uid && so.seller.userId !== uid && !staff) throw Errors.forbidden();
    const seal = await ensureSeal(so.seller.userId, so.seller.farmName, so.seller.user.fullName);
    const contract = await prisma.contract.findUnique({ where: { sellerOrderId: so.id }, select: { id: true, number: true, status: true, publicId: true } });
    const pay = so.order.payments[0];
    ok(res, {
      number: `HF-${so.number}`,
      sellerOrderId: so.id,
      orderNumber: so.number,
      date: so.createdAt,
      status: so.status,
      seller: { farm: so.seller.farmName, name: so.seller.user.fullName, tin: so.seller.tin, address: [so.seller.address, so.seller.district].filter(Boolean).join(', '), region: so.seller.region, phone: so.seller.user.phone, email: so.seller.user.email },
      sellerSeal: { code: seal.code, title: seal.title, subtitle: seal.subtitle, color: seal.color },
      buyer: { name: so.order.recipientName, company: so.order.buyer.buyerProfile?.companyName ?? null, phone: so.order.contactPhone, address: [so.order.region, so.order.district, so.order.addressLine].filter(Boolean).join(', ') },
      items: so.items.map((i) => ({ name: i.productName, quantity: i.quantity, unit: i.unit, price: i.unitPrice, total: i.lineTotal })),
      subtotal: so.subtotal,
      deliveryFee: so.deliveryFee,
      discount: so.discount,
      total: so.total,
      payment: { method: so.order.paymentMethod, status: so.order.paymentStatus, provider: pay?.provider ?? null },
      delivery: so.delivery,
      contract,
      platform: { name: 'AgroMarket', site: env.APP_URL },
    });
  }),
);

r.get(
  '/sanction/:id',
  ah(async (req, res) => {
    const s = await prisma.sanction.findUnique({ where: { id: req.params.id }, include: { seller: { select: { farmName: true, tin: true, address: true, region: true, district: true } } } });
    if (!s) throw Errors.notFound('Hujjat');
    if (req.user!.role !== 'ADMIN' && s.userId !== req.user!.id) throw Errors.forbidden();
    const [user, issuer, complaint] = await Promise.all([
      prisma.user.findUnique({ where: { id: s.userId }, select: { fullName: true, phone: true, email: true } }),
      prisma.user.findUnique({ where: { id: s.createdById }, select: { fullName: true } }),
      s.complaintId ? prisma.complaint.findUnique({ where: { id: s.complaintId }, select: { subject: true, description: true, createdAt: true } }) : Promise.resolve(null),
    ]);
    ok(res, { ...s, user, issuer, complaint, platformSeal: platformSeal() });
  }),
);

export default r;
