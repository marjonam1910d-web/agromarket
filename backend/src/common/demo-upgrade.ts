import type { PrismaClient } from '@prisma/client';
import { CATEGORY_PHOTOS, FARM_PHOTOS, PRODUCT_PHOTOS } from './demo-photos';

/**
 * Demo ma'lumotlarni yangi imkoniyatlar bilan boyitadi (faqat demo yozuvlarga tegadi, idempotent):
 *  - eski chizilgan (SVG) rasmlar → real fotolar
 *  - demo fermerlarga email (email bilan kirish uchun) va xo'jalik muqovasi
 *  - xaritada ko'rinadigan sotuv nuqtalari
 */
const DEMO_EMAILS: Record<string, string> = {
  '+998911234567': 'fermer@agromarket.uz',
  '+998912345678': 'fermer2@agromarket.uz',
  '+998913456789': 'fermer3@agromarket.uz',
  '+998931234567': 'fermer4@agromarket.uz',
  '+998901112233': 'ulgurji@agromarket.uz',
};

const DEMO_POINTS: Record<string, { type: 'FARM' | 'SALES_CENTER' | 'WAREHOUSE' | 'PICKUP'; name: string; region: string; district: string; address: string; lat: number; lng: number; hours: string }[]> = {
  '+998911234567': [
    { type: 'FARM', name: "Bog'iston — asosiy xo'jalik", region: 'namangan', district: 'Chust', address: "Chust tumani, Bog'iston MFY, 12-uy", lat: 41.0037, lng: 71.2372, hours: '07:00–19:00' },
    { type: 'SALES_CENTER', name: "Bog'iston sotuv markazi", region: 'namangan', district: 'Namangan shahri', address: "Namangan sh., Chorsu bozori, 4-rasta", lat: 40.9983, lng: 71.6726, hours: '06:00–18:00' },
    { type: 'PICKUP', name: "Bog'iston — Toshkent olib ketish nuqtasi", region: 'toshkent-sh', district: 'Shayxontohur', address: 'Toshkent sh., Chorsu bozori yonida', lat: 41.3264, lng: 69.2346, hours: '09:00–20:00' },
  ],
  '+998912345678': [
    { type: 'FARM', name: "Zarafshon Agro — dala", region: 'samarqand', district: 'Urgut', address: "Urgut tumani, Qoratepa qishlog'i", lat: 39.402, lng: 67.243, hours: '07:00–18:00' },
    { type: 'SALES_CENTER', name: 'Zarafshon Agro — Siyob bozori', region: 'samarqand', district: 'Samarqand shahri', address: 'Samarqand sh., Siyob bozori, quruq mevalar qatori', lat: 39.6619, lng: 66.9822, hours: '06:00–19:00' },
  ],
  '+998913456789': [
    { type: 'FARM', name: "Farg'ona Sut va Go'sht — ferma", region: 'fargona', district: 'Quva', address: "Quva tumani, Yangi hayot ko'chasi 5", lat: 40.522, lng: 72.07, hours: '06:00–20:00' },
    { type: 'SALES_CENTER', name: "Sut mahsulotlari do'koni", region: 'fargona', district: "Farg'ona shahri", address: "Farg'ona sh., Mustaqillik ko'chasi 21", lat: 40.3842, lng: 71.7843, hours: '08:00–21:00' },
    { type: 'WAREHOUSE', name: 'Sovutgichli ombor — Toshkent', region: 'toshkent-sh', district: 'Yunusobod', address: "Toshkent sh., Yunusobod, Amir Temur ko'chasi 108", lat: 41.364, lng: 69.287, hours: '24/7' },
  ],
};

export async function upgradeDemo(prisma: PrismaClient) {
  let photos = 0;
  for (const [key, url] of Object.entries(PRODUCT_PHOTOS)) {
    const old = `/uploads/public/seed/${key}.svg`;
    photos += (await prisma.productImage.updateMany({ where: { url: old }, data: { url, thumbUrl: url } })).count;
    await prisma.productImage.updateMany({ where: { thumbUrl: old }, data: { thumbUrl: url } });
    await prisma.orderItem.updateMany({ where: { imageUrl: old }, data: { imageUrl: url } });
  }
  for (const [slug, url] of Object.entries(CATEGORY_PHOTOS)) await prisma.category.updateMany({ where: { slug, imageUrl: null }, data: { imageUrl: url } });

  let emails = 0;
  for (const [phone, email] of Object.entries(DEMO_EMAILS)) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!taken) emails += (await prisma.user.updateMany({ where: { phone, email: null }, data: { email, emailVerifiedAt: new Date() } })).count;
  }
  for (const [phone, url] of Object.entries(FARM_PHOTOS)) await prisma.sellerProfile.updateMany({ where: { user: { phone }, coverUrl: null }, data: { coverUrl: url } });

  let points = 0;
  for (const [phone, list] of Object.entries(DEMO_POINTS)) {
    const sp = await prisma.sellerProfile.findFirst({ where: { user: { phone } }, select: { id: true, _count: { select: { salesPoints: true } } } });
    if (!sp || sp._count.salesPoints) continue;
    points += (await prisma.salesPoint.createMany({ data: list.map((p) => ({ ...p, sellerId: sp.id })) })).count;
  }
  return { photos, emails, points };
}
