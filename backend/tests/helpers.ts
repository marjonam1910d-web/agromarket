import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma, Prisma } from '../src/lib/prisma';
import { REGIONS } from '../src/common/regions';

export const app = createApp();
export { prisma };
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Barcha jadvallarni tozalash (testlar orasida) */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

/** CSRF cookie bilan ishlaydigan "brauzer" klienti */
export async function client() {
  const agent = request.agent(app);
  const res = await agent.get('/api/v1/auth/csrf');
  const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('am_csrf='))!;
  const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  const wrap = (m: 'post' | 'put' | 'patch' | 'delete') => (url: string) => agent[m](url).set('x-csrf-token', token);
  return { agent, get: (url: string) => agent.get(url), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), del: wrap('delete'), token };
}

let seq = 0;
export async function makeUser(role: Role, opts: { approved?: boolean; region?: string } = {}) {
  seq++;
  const phone = `+99890${String(1000000 + seq * 7919).slice(-7)}`;
  const password = 'Passw0rd123';
  const u = await prisma.user.create({
    data: {
      phone,
      fullName: `${role} User ${seq}`,
      role,
      passwordHash: await bcrypt.hash(password, 4),
      phoneVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      cart: { create: {} },
      ...(role === 'BUYER' ? { buyerProfile: { create: {} } } : {}),
      ...(role === 'SELLER'
        ? {
            sellerProfile: {
              create: {
                farmName: `Farm ${seq}`,
                slug: `farm-${seq}-${Date.now()}`,
                region: opts.region ?? 'namangan',
                district: 'Chust',
                address: 'Test address 1',
                verificationStatus: opts.approved === false ? 'NOT_SUBMITTED' : 'APPROVED',
              },
            },
          }
        : {}),
    },
    include: { sellerProfile: true },
  });
  const c = await client();
  const res = await c.post('/api/v1/auth/login').send({ login: phone, password });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return { user: u, c, phone, password, sellerId: u.sellerProfile?.id };
}

export async function makeCategory() {
  return prisma.category.create({ data: { slug: `cat-${Date.now()}-${seq++}`, nameUz: 'Sabzavotlar', nameRu: 'Овощи', nameEn: 'Vegetables' } });
}

/** To'g'ridan-to'g'ri faol mahsulot + barcha viloyatlarga yetkazish zonasi */
export async function makeProduct(sellerId: string, categoryId: string, opts: { stock?: number; price?: number; name?: string; min?: number } = {}) {
  const zones = await prisma.deliveryZone.count({ where: { sellerId } });
  if (!zones) {
    await prisma.deliveryZone.createMany({
      data: REGIONS.map((r) => ({ sellerId, region: r.code, baseFee: D(20000), perKgFee: D(500), freeFromAmount: D(500000), minDays: 0, maxDays: 2 })),
    });
  }
  const price = opts.price ?? 10000;
  return prisma.product.create({
    data: {
      sellerId,
      categoryId,
      name: opts.name ?? 'Pomidor',
      slug: `p-${Date.now()}-${seq++}`,
      description: 'Yangi uzilgan, mahalliy hosil',
      price: D(price),
      effectivePrice: D(price),
      unit: 'kg',
      minOrderQty: D(opts.min ?? 1),
      region: 'namangan',
      district: 'Chust',
      status: 'active',
      inventory: { create: { quantity: D(opts.stock ?? 100) } },
    },
  });
}

export function tomorrow() {
  const d = new Date(Date.now() + 86400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(d);
}

export const address = {
  recipientName: 'Test Buyer',
  phone: '+998901234567',
  region: 'toshkent-sh',
  district: 'Chilonzor',
  street: 'Bunyodkor 1',
};

export async function checkoutCash(c: Awaited<ReturnType<typeof client>>, method: 'cash' | 'payme' | 'click' | 'card' = 'cash') {
  return c.post('/api/v1/orders/checkout').send({ address, deliveryDate: tomorrow(), deliverySlot: '15:00-18:00', paymentMethod: method, termsAccepted: true });
}
