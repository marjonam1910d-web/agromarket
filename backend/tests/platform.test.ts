import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { qrMatrix } from '../src/lib/qr';
import { checkoutCash, client, makeCategory, makeProduct, makeUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

/** Buyurtma → fermer tomonidan yo'lga chiqarilgan holatgacha */
async function orderShipped(method: 'cash' | 'card' = 'cash', opts: { price?: number; qty?: number } = {}) {
  const seller = await makeUser('SELLER');
  const cat = await makeCategory();
  const p = await makeProduct(seller.sellerId!, cat.id, { stock: 500, price: opts.price ?? 20000 });
  const buyer = await makeUser('BUYER');
  await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: opts.qty ?? 5 });
  const co = await checkoutCash(buyer.c, method);
  expect(co.status).toBe(201);
  const orderId = co.body.data.order.id as string;
  if (method !== 'cash') {
    // provayder webhooki o'rniga: to'lov muvaffaqiyatli deb belgilanadi (to'lov oqimi payments.test'da sinalgan)
    await prisma.payment.updateMany({ where: { orderId }, data: { status: 'paid', paidAt: new Date() } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: 'paid' } });
  }
  const so = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId } });
  for (const status of ['confirmed', 'preparing', 'ready_for_delivery']) expect((await seller.c.post(`/api/v1/orders/seller/${so.id}/status`).send({ status })).status).toBe(200);
  expect((await seller.c.post(`/api/v1/orders/seller/${so.id}/status`).send({ status: 'shipped', courierName: 'Kuryer', courierPhone: '909876543' })).status).toBe(200);
  return { seller, buyer, orderId, soId: so.id, so };
}

describe('Xarita: sotuv nuqtalari', () => {
  it("fermer nuqta qo'shadi, ommaviy xaritada faqat tasdiqlangan fermer ko'rinadi, O'zbekistondan tashqari rad etiladi", async () => {
    const seller = await makeUser('SELLER');
    const pending = await makeUser('SELLER', { approved: false });
    const body = { type: 'SALES_CENTER', name: 'Chorsu rastasi', region: 'toshkent-sh', district: 'Shayxontohur', address: 'Chorsu bozori', lat: 41.3264, lng: 69.2346 };
    expect((await seller.c.post('/api/v1/maps/my-points').send(body)).status).toBe(201);
    expect((await seller.c.post('/api/v1/maps/my-points').send({ ...body, lat: 55.75, lng: 37.61 })).status).toBe(422);
    expect((await pending.c.post('/api/v1/maps/my-points').send(body)).status).toBe(201);
    const pub = await (await client()).get('/api/v1/maps/points?south=41&west=69&north=42&east=70');
    expect(pub.status).toBe(200);
    expect(pub.body.data).toHaveLength(1);
    expect(pub.body.data[0].seller.id).toBe(seller.sellerId);
    const buyer = await makeUser('BUYER');
    expect((await buyer.c.post('/api/v1/maps/my-points').send(body)).status).toBe(403);
  });
});

describe('Jonli yetkazish', () => {
  it("fermer kuzatuvni boshlaydi va joylashuv yuboradi; xaridor ko'radi; begona ko'ra olmaydi", async () => {
    const { seller, buyer, soId } = await orderShipped();
    expect((await seller.c.post(`/api/v1/maps/tracking/${soId}/location`).send({ lat: 41.3, lng: 69.2 })).status).toBe(409);
    expect((await seller.c.post(`/api/v1/maps/tracking/${soId}/start`).send({ lat: 41.0037, lng: 71.2372 })).status).toBe(200);
    expect((await seller.c.post(`/api/v1/maps/tracking/${soId}/location`).send({ lat: 41.2, lng: 70.5, heading: 270 })).status).toBe(200);
    const view = await buyer.c.get(`/api/v1/maps/tracking/${soId}`);
    expect(view.status).toBe(200);
    expect(view.body.data).toMatchObject({ trackingActive: true, courier: { lat: 41.2, lng: 70.5 }, origin: { lat: 41.0037, lng: 71.2372 } });
    const stranger = await makeUser('BUYER');
    expect((await stranger.c.get(`/api/v1/maps/tracking/${soId}`)).status).toBe(404);
    const otherSeller = await makeUser('SELLER');
    expect((await otherSeller.c.post(`/api/v1/maps/tracking/${soId}/location`).send({ lat: 41.2, lng: 70.5 })).status).toBe(404);
  });
});

describe('Elektron shartnoma', () => {
  it("buyurtmadan shartnoma → yuborish → ikki tomon parol bilan imzolaydi → QR tekshiruvi haqiqiy; matn o'zgartirilsa — haqiqiy emas", async () => {
    const { seller, buyer, soId } = await orderShipped();
    const c1 = await buyer.c.post(`/api/v1/contracts/from-order/${soId}`);
    expect(c1.status).toBe(201);
    const id = c1.body.data.id;
    // takror — o'sha shartnoma
    expect((await seller.c.post(`/api/v1/contracts/from-order/${soId}`)).body.data).toMatchObject({ id, existing: true });
    const draft = (await buyer.c.get(`/api/v1/contracts/${id}`)).body.data;
    expect(draft.status).toBe('draft');
    expect(draft.terms.items[0].quantity).toBe(5);

    // qoralamani imzolab bo'lmaydi
    expect((await buyer.c.post(`/api/v1/contracts/${id}/sign`).send({ password: buyer.password, agree: true })).status).toBe(409);
    // shartni o'zgartirish
    const upd = await seller.c.patch(`/api/v1/contracts/${id}`).send({ terms: { ...draft.terms, prepaymentPercent: 30, extraTerms: 'Qadoq — 10 kg yashik' } });
    expect(upd.status).toBe(200);
    expect(upd.body.data.terms.prepaymentPercent).toBe(30);

    const sent = await seller.c.post(`/api/v1/contracts/${id}/send`);
    expect(sent.body.data.status).toBe('pending');
    expect(sent.body.data.contentHash).toMatch(/^[a-f0-9]{64}$/);
    // yuborilgandan keyin tahrirlab bo'lmaydi
    expect((await seller.c.patch(`/api/v1/contracts/${id}`).send({ terms: draft.terms })).status).toBe(409);

    expect((await buyer.c.post(`/api/v1/contracts/${id}/sign`).send({ password: 'xato-parol', agree: true })).status).toBe(400);
    const s1 = await buyer.c.post(`/api/v1/contracts/${id}/sign`).send({ password: buyer.password, agree: true });
    expect(s1.status).toBe(200);
    expect(s1.body.data.status).toBe('pending');
    expect((await buyer.c.post(`/api/v1/contracts/${id}/sign`).send({ password: buyer.password, agree: true })).status).toBe(409);
    const s2 = await seller.c.post(`/api/v1/contracts/${id}/sign`).send({ password: seller.password, agree: true });
    expect(s2.body.data.status).toBe('signed');
    expect(s2.body.data.signatures).toHaveLength(2);
    expect(s2.body.data.signatures.every((s: { valid: boolean }) => s.valid)).toBe(true);
    // har bir tomonda o'zgarmas shaxsiy muhr paydo bo'ldi
    const seal = (await buyer.c.get('/api/v1/contracts/seal')).body.data;
    expect(seal.code).toMatch(/^AM-[A-F0-9]{5}-[A-F0-9]{5}$/);
    expect((await buyer.c.post('/api/v1/contracts/seal').send({})).status).toBe(409);

    // QR: ommaviy tekshiruv (tizimga kirmasdan)
    const publicId = s2.body.data.publicId;
    const anon = await client();
    const v = await anon.get(`/api/v1/contracts/verify/${publicId}`);
    expect(v.status).toBe(200);
    expect(v.body.data.integrity).toBe(true);
    expect(v.body.data.buyer.phone).toMatch(/\*/);
    const qr = await anon.get(`/api/v1/contracts/verify/${publicId}/qr.svg`);
    expect(qr.headers['content-type']).toMatch(/svg/);
    expect(qrMatrix(`${env.APP_URL}/c/${publicId}`).length).toBeGreaterThan(20);

    // imzolangan shartnomani bekor qilib/tahrirlab bo'lmaydi
    expect((await seller.c.post(`/api/v1/contracts/${id}/cancel`)).status).toBe(403);
    // bazada matn soxtalashtirilsa — tekshiruv buni aniqlaydi
    await prisma.contract.update({ where: { id }, data: { totalAmount: 1 } });
    expect((await anon.get(`/api/v1/contracts/verify/${publicId}`)).body.data.integrity).toBe(false);
  });

  it("erkin shartnoma telefon orqali; rad etish; begona ko'ra olmaydi", async () => {
    const seller = await makeUser('SELLER');
    const buyer = await makeUser('BUYER');
    const terms = { items: [{ name: 'Kartoshka (Sante)', quantity: 2000, unit: 'kg', price: 4500 }], deliveryAddress: 'Toshkent sh., Yunusobod', deliveryDate: '2026-12-01' };
    const c = await seller.c.post('/api/v1/contracts').send({ counterpart: buyer.phone, title: 'Kartoshka yetkazib berish shartnomasi', terms });
    expect(c.status).toBe(201);
    const id = c.body.data.id;
    const full = (await buyer.c.get(`/api/v1/contracts/${id}`)).body.data;
    expect(Number(full.totalAmount)).toBe(9_000_000);
    expect(full.myRole).toBe('BUYER');
    await seller.c.post(`/api/v1/contracts/${id}/send`);
    const rej = await buyer.c.post(`/api/v1/contracts/${id}/reject`).send({ reason: 'Narx yuqori' });
    expect(rej.body.data.status).toBe('rejected');
    const stranger = await makeUser('BUYER');
    expect((await stranger.c.get(`/api/v1/contracts/${id}`)).status).toBe(404);
    // xaridor xaridorga shartnoma tuza olmaydi
    expect((await buyer.c.post('/api/v1/contracts').send({ counterpart: stranger.phone, title: 'Noto\'g\'ri shartnoma', terms })).status).toBe(400);
  });
});

describe('Hamyon', () => {
  it("onlayn to'langan buyurtma yetkazilganda fermerga o'tkaziladi (bir marta); naqdda komissiya yechiladi", async () => {
    const online = await orderShipped('card', { price: 20000, qty: 5 });
    expect((await online.buyer.c.post(`/api/v1/orders/seller-orders/${online.soId}/receive`)).status).toBe(200);
    const so = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: online.soId } });
    const w = (await online.seller.c.get('/api/v1/wallet')).body.data;
    expect(Number(w.balance.available)).toBe(Number(so.sellerPayout));
    expect(w.transactions[0].kind).toBe('order_payout');
    expect(await prisma.walletTransaction.count({ where: { kind: 'order_payout', refId: online.soId } })).toBe(1);

    const cash = await orderShipped('cash', { price: 10000, qty: 10 });
    await cash.buyer.c.post(`/api/v1/orders/seller-orders/${cash.soId}/receive`);
    const so2 = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: cash.soId } });
    const w2 = (await cash.seller.c.get('/api/v1/wallet')).body.data;
    expect(Number(w2.balance.available)).toBe(-Number(so2.commissionAmount));
  });

  it("yechib olish: mablag' yetmasa rad; sinov kartasiga darhol; parallel so'rovlar balansdan oshmaydi", async () => {
    const online = await orderShipped('card', { price: 50000, qty: 4 });
    await online.buyer.c.post(`/api/v1/orders/seller-orders/${online.soId}/receive`);
    const so = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: online.soId } });
    const payout = Number(so.sellerPayout);
    const card = await prisma.paymentCard.create({ data: { userId: online.seller.user.id, provider: 'sandbox', token: 'sbx_t', maskedPan: '8600 06** **** 6311', expire: '12/30', brand: 'UZCARD', isDefault: true } });
    expect((await online.seller.c.post('/api/v1/wallet/withdraw').send({ amount: payout + 1000, cardId: card.id })).status).toBe(400);
    const half = Math.floor(payout * 0.6);
    const results = await Promise.all([1, 2, 3].map(() => online.seller.c.post('/api/v1/wallet/withdraw').send({ amount: half, cardId: card.id })));
    const okCount = results.filter((r) => r.status === 201).length;
    expect(okCount).toBe(1);
    const w = (await online.seller.c.get('/api/v1/wallet')).body.data;
    expect(Number(w.balance.available)).toBeGreaterThanOrEqual(0);
  });
});

describe("Aloqa va admin", () => {
  it("xaridor adminga yozadi; admin foydalanuvchilarni kategoriya bo'yicha ko'radi; fermer faqat o'z xaridoriga yoza oladi", async () => {
    const admin = await makeUser('ADMIN');
    const buyer = await makeUser('BUYER');
    const s = await buyer.c.post('/api/v1/conversations/support').send({ message: { body: "Salom, to'lov bo'yicha savolim bor" } });
    expect(s.status).toBe(201);
    const conv = await prisma.conversation.findUniqueOrThrow({ where: { id: s.body.data.conversationId } });
    expect(conv).toMatchObject({ kind: 'SUPPORT', sellerUserId: admin.user.id });
    const list = (await buyer.c.get('/api/v1/conversations')).body.data;
    expect(list[0].counterpart.name).toMatch(/AgroMarket/);
    expect((await admin.c.get(`/api/v1/conversations/${conv.id}/messages`)).status).toBe(200);

    const stats = await admin.c.get('/api/v1/admin/users/stats');
    expect(stats.body.data.roles).toMatchObject({ ADMIN: 1, BUYER: 1 });
    expect((await buyer.c.get('/api/v1/admin/users/stats')).status).toBe(403);

    const seller = await makeUser('SELLER');
    expect((await seller.c.post(`/api/v1/conversations/with-buyer/${buyer.user.id}`).send({ message: { body: 'Salom' } })).status).toBe(403);
    expect((await buyer.c.post('/api/v1/conversations/translate').send({ text: 'Salom', to: 'ru' })).status).toBe(503);
  });
});
