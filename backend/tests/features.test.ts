import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { checkoutCash, client, makeCategory, makeProduct, makeUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

const b64u = (b: Buffer) => b.toString('base64url');

/** Platform autentifikatorini (barmoq izi) simulyatsiya qiladi: haqiqiy P-256 kalit, authData va imzo */
function fakeAuthenticator() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const credentialId = b64u(crypto.randomBytes(32));
  const origin = new URL(env.APP_URL).origin;
  const rpIdHash = crypto.createHash('sha256').update(new URL(env.APP_URL).hostname).digest();
  let counter = 0;
  return {
    credentialId,
    publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' }) as Buffer),
    create(challenge: string) {
      return b64u(Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge, origin })));
    },
    get(challenge: string, opts: { uv?: boolean; counter?: number } = {}) {
      counter = opts.counter ?? counter + 1;
      const flags = 0x01 | (opts.uv === false ? 0 : 0x04);
      const authData = Buffer.concat([rpIdHash, Buffer.from([flags]), Buffer.from([(counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255])]);
      const clientData = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
      const signature = crypto.sign('sha256', Buffer.concat([authData, crypto.createHash('sha256').update(clientData).digest()]), privateKey);
      return { credentialId, clientDataJSON: b64u(clientData), authenticatorData: b64u(authData), signature: b64u(signature) };
    },
  };
}

describe('Ilova qulfi: PIN', () => {
  it("PIN o'rnatiladi, to'g'ri PIN ochadi, oddiy PIN rad etiladi", async () => {
    const { c } = await makeUser('BUYER');
    expect((await c.post('/api/v1/security/app-lock').send({ pin: '1234' })).status).toBe(400);
    const setup = await c.post('/api/v1/security/app-lock').send({ pin: '4826' });
    expect(setup.status).toBe(201);
    const id = setup.body.data.deviceId;
    expect((await c.get(`/api/v1/security/app-lock/${id}`)).body.data).toMatchObject({ exists: true, biometric: false });
    expect((await c.post(`/api/v1/security/app-lock/${id}/verify`).send({ pin: '4826' })).status).toBe(200);
    const bad = await c.post(`/api/v1/security/app-lock/${id}/verify`).send({ pin: '0001' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.attemptsLeft).toBe(4);
    // PIN hech qachon ochiq saqlanmaydi
    const row = await prisma.appDevice.findUniqueOrThrow({ where: { id } });
    expect(row.pinHash).not.toContain('4826');
  });

  it("5 marta xato PIN → qurilma o'chiriladi va barcha sessiyalar yopiladi", async () => {
    const { c } = await makeUser('BUYER');
    const id = (await c.post('/api/v1/security/app-lock').send({ pin: '4826' })).body.data.deviceId;
    for (let i = 0; i < 4; i++) expect((await c.post(`/api/v1/security/app-lock/${id}/verify`).send({ pin: '9990' })).status).toBe(400);
    const last = await c.post(`/api/v1/security/app-lock/${id}/verify`).send({ pin: '9990' });
    expect(last.status).toBe(401);
    expect(last.body.error.code).toBe('APP_LOCK_RESET');
    expect(await prisma.appDevice.count()).toBe(0);
    expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("boshqa foydalanuvchining qurilmasi ko'rinmaydi", async () => {
    const a = await makeUser('BUYER');
    const b = await makeUser('BUYER');
    const id = (await a.c.post('/api/v1/security/app-lock').send({ pin: '4826' })).body.data.deviceId;
    expect((await b.c.get(`/api/v1/security/app-lock/${id}`)).body.data.exists).toBe(false);
    expect((await b.c.post(`/api/v1/security/app-lock/${id}/verify`).send({ pin: '4826' })).status).toBe(404);
  });
});

describe('Ilova qulfi: barmoq izi (WebAuthn)', () => {
  it("ro'yxatdan o'tkazish va imzo bilan ochish; challenge qayta ishlatilmaydi; UV talab qilinadi", async () => {
    const { c } = await makeUser('BUYER');
    const id = (await c.post('/api/v1/security/app-lock').send({ pin: '4826' })).body.data.deviceId;
    const auth = fakeAuthenticator();

    const ch1 = (await c.post(`/api/v1/security/app-lock/${id}/biometric/challenge`).send({ purpose: 'create' })).body.data;
    const reg = await c.post(`/api/v1/security/app-lock/${id}/biometric/register`).send({ pin: '4826', credentialId: auth.credentialId, publicKey: auth.publicKey, alg: -7, clientDataJSON: auth.create(ch1.challenge) });
    expect(reg.status).toBe(200);

    const ch2 = (await c.post(`/api/v1/security/app-lock/${id}/biometric/challenge`).send({ purpose: 'get' })).body.data;
    expect(ch2.credentialId).toBe(auth.credentialId);
    const assertion = auth.get(ch2.challenge);
    expect((await c.post(`/api/v1/security/app-lock/${id}/biometric/verify`).send(assertion)).status).toBe(200);
    // xuddi shu javobni qayta yuborish (replay) — rad etiladi
    expect((await c.post(`/api/v1/security/app-lock/${id}/biometric/verify`).send(assertion)).status).toBe(400);

    // barmoq izi tasdiqlanmagan (UV=0) — rad etiladi
    const ch3 = (await c.post(`/api/v1/security/app-lock/${id}/biometric/challenge`).send({ purpose: 'get' })).body.data;
    expect((await c.post(`/api/v1/security/app-lock/${id}/biometric/verify`).send(auth.get(ch3.challenge, { uv: false }))).status).toBe(400);

    // boshqa kalit bilan imzolangan — rad etiladi
    const other = fakeAuthenticator();
    const ch4 = (await c.post(`/api/v1/security/app-lock/${id}/biometric/challenge`).send({ purpose: 'get' })).body.data;
    const forged = { ...other.get(ch4.challenge), credentialId: auth.credentialId };
    expect((await c.post(`/api/v1/security/app-lock/${id}/biometric/verify`).send(forged)).status).toBe(400);
  });
});

describe('Demo kirish', () => {
  it("demo xaridor bilan kiradi; admin demo orqali ochilmaydi", async () => {
    await makeUser('BUYER'); // tasodifiy foydalanuvchi
    await prisma.user.create({ data: { phone: '+998901234567', fullName: 'Demo Xaridor', role: 'BUYER', passwordHash: 'x', termsAcceptedAt: new Date() } });
    const c = await client();
    const r = await c.post('/api/v1/auth/demo-login').send({ role: 'BUYER' });
    expect(r.status).toBe(200);
    expect(r.body.data.user.role).toBe('BUYER');
    expect((await c.get('/api/v1/auth/me')).status).toBe(200);
    expect((await c.post('/api/v1/auth/demo-login').send({ role: 'ADMIN' })).status).toBe(422);
  });
});

describe("Saqlangan karta (sandbox) va bir bosishda to'lov", () => {
  it("karta raqami saqlanmaydi; SMS kod bilan qo'shiladi; karta bilan to'lov buyurtmani to'langan qiladi", async () => {
    const saved = env.paymeEnabled;
    (env as { paymeEnabled: boolean }).paymeEnabled = false; // test muhitida Payme kalitlari bor — sandbox oqimini sinaymiz
    try {
    const seller = await makeUser('SELLER');
    const cat = await makeCategory();
    const p = await makeProduct(seller.sellerId!, cat.id, { stock: 50 });
    const buyer = await makeUser('BUYER');

    const start = await buyer.c.post('/api/v1/payments/cards/sandbox/start').send({ number: '8600069195406311', expire: '12/30' });
    expect(start.status).toBe(200);
    expect((await buyer.c.post('/api/v1/payments/cards/sandbox/verify').send({ pending: start.body.data.pending, code: '000000' })).status).toBe(400);
    const add = await buyer.c.post('/api/v1/payments/cards/sandbox/verify').send({ pending: start.body.data.pending, code: '666666', label: 'Asosiy' });
    expect(add.status).toBe(201);
    expect(add.body.data).toMatchObject({ maskedPan: '8600 06** **** 6311', brand: 'UZCARD', isDefault: true });
    const stored = await prisma.paymentCard.findFirstOrThrow();
    expect(JSON.stringify(stored)).not.toContain('8600069195406311');
    expect((await buyer.c.get('/api/v1/payments/cards')).body.data[0]).not.toHaveProperty('token');

    // noto'g'ri brend rad etiladi
    expect((await buyer.c.post('/api/v1/payments/cards/sandbox/start').send({ number: '4111111111111111', expire: '12/30' })).status).toBe(400);

    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 2 });
    const order = await checkoutCash(buyer.c, 'card');
    expect(order.status).toBe(201);
    const orderId = order.body.data.orderId ?? order.body.data.order?.id ?? order.body.data.id;
    const pay = await buyer.c.post('/api/v1/payments/cards/pay').send({ orderId, cardId: add.body.data.id });
    expect(pay.status).toBe(200);
    expect(pay.body.data.status).toBe('paid');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paymentStatus).toBe('paid');

    // boshqa xaridor bu karta bilan to'lay olmaydi
    const other = await makeUser('BUYER');
    expect((await other.c.post('/api/v1/payments/cards/pay').send({ orderId, cardId: add.body.data.id })).status).toBe(404);
    } finally {
      (env as { paymeEnabled: boolean }).paymeEnabled = saved;
    }
  });
});

describe('Kategoriyalar bo\'yicha hisobot', () => {
  it("admin barcha kategoriyalarni ko'radi va batafsil ochadi; xaridorga taqiqlangan", async () => {
    const seller = await makeUser('SELLER');
    const cat = await makeCategory();
    const p = await makeProduct(seller.sellerId!, cat.id, { stock: 50, price: 15000 });
    const buyer = await makeUser('BUYER');
    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 3 });
    expect((await checkoutCash(buyer.c)).status).toBe(201);

    const admin = await makeUser('ADMIN');
    const list = await admin.c.get('/api/v1/analytics/categories?days=30');
    expect(list.status).toBe(200);
    const row = list.body.data.categories.find((x: { slug: string }) => x.slug === cat.slug);
    expect(row).toMatchObject({ revenue: 45000, orders: 1, quantity: 3, share: 100, activeProducts: 1 });

    const detail = await admin.c.get(`/api/v1/analytics/categories/${cat.slug}?days=30`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.summary.revenue).toBe(45000);
    expect(detail.body.data.topProducts[0]).toMatchObject({ id: p.id, quantity: 3 });
    expect(detail.body.data.topSellers.length).toBe(1);

    // sotuvchi faqat o'zinikini ko'radi
    const s2 = await makeUser('SELLER');
    const mine = await s2.c.get('/api/v1/analytics/categories');
    expect(mine.body.data.categories.find((x: { slug: string }) => x.slug === cat.slug).revenue).toBe(0);

    expect((await buyer.c.get('/api/v1/analytics/categories')).status).toBe(403);
  });
});
