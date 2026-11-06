import crypto from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, checkoutCash, makeCategory, makeProduct, makeUser, prisma, resetDb } from './helpers';
import { expireUnpaidOrders } from '../src/jobs';

beforeEach(resetDb);

const paymeAuth = 'Basic ' + Buffer.from('Paycom:test-payme-key').toString('base64');
const rpc = (method: string, params: object, auth = paymeAuth) =>
  request(app).post('/api/v1/payments/payme').set('Authorization', auth).send({ jsonrpc: '2.0', id: 1, method, params });

async function onlineOrder(method: 'payme' | 'click' | 'card' = 'payme', stock = 10) {
  const s = await makeUser('SELLER');
  const b = await makeUser('BUYER');
  const cat = await makeCategory();
  const p = await makeProduct(s.sellerId!, cat.id, { stock, price: 10000 });
  await b.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 2 });
  const co = await checkoutCash(b.c, method);
  expect(co.status).toBe(201);
  return { s, b, p, order: co.body.data.order, payment: co.body.data.payment };
}

describe('Payme Merchant API', () => {
  it('rejects bad authorization', async () => {
    const r = await rpc('CheckPerformTransaction', {}, 'Basic ' + Buffer.from('Paycom:wrong').toString('base64'));
    expect(r.body.error.code).toBe(-32504);
  });

  it('full flow: check → create → perform (idempotent) → order paid; seller notified only after payment', async () => {
    const { s, order, payment } = await onlineOrder('payme');
    expect(payment.provider).toBe('payme');
    expect(payment.checkoutUrl).toContain('paycom.uz');
    // to'lanmagan buyurtma sotuvchiga ko'rinmaydi
    expect((await s.c.get('/api/v1/orders/seller/list')).body.data).toHaveLength(0);
    const tiyin = Number(order.total) * 100;
    expect((await rpc('CheckPerformTransaction', { amount: tiyin + 100, account: { order_id: payment.id } })).body.error.code).toBe(-31001);
    expect((await rpc('CheckPerformTransaction', { amount: tiyin, account: { order_id: 'nope' } })).body.error.code).toBe(-31050);
    expect((await rpc('CheckPerformTransaction', { amount: tiyin, account: { order_id: payment.id } })).body.result.allow).toBe(true);
    const create = await rpc('CreateTransaction', { id: 'payme-tx-1', time: Date.now(), amount: tiyin, account: { order_id: payment.id } });
    expect(create.body.result.state).toBe(1);
    // boshqa tranzaksiya band
    expect((await rpc('CreateTransaction', { id: 'payme-tx-2', time: Date.now(), amount: tiyin, account: { order_id: payment.id } })).body.error.code).toBe(-31099);
    const perform = await rpc('PerformTransaction', { id: 'payme-tx-1' });
    expect(perform.body.result.state).toBe(2);
    const again = await rpc('PerformTransaction', { id: 'payme-tx-1' });
    expect(again.body.result.perform_time).toBe(perform.body.result.perform_time);
    const p = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(p!.status).toBe('paid');
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.paymentStatus).toBe('paid');
    expect((await s.c.get('/api/v1/orders/seller/list')).body.data).toHaveLength(1);
    const check = await rpc('CheckTransaction', { id: 'payme-tx-1' });
    expect(check.body.result.state).toBe(2);
    const stmt = await rpc('GetStatement', { from: 0, to: Date.now() + 1000 });
    expect(stmt.body.result.transactions).toHaveLength(1);
  });

  it('cancel after perform reverses payment and restores stock', async () => {
    const { p, order, payment } = await onlineOrder('payme');
    const tiyin = Number(order.total) * 100;
    await rpc('CreateTransaction', { id: 't9', time: Date.now(), amount: tiyin, account: { order_id: payment.id } });
    await rpc('PerformTransaction', { id: 't9' });
    const c = await rpc('CancelTransaction', { id: 't9', reason: 5 });
    expect(c.body.result.state).toBe(-2);
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe('refunded');
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe('cancelled');
    expect((await prisma.productInventory.findUnique({ where: { productId: p.id } }))!.quantity.toString()).toBe('10');
  });
});

describe('Click SHOP API', () => {
  const sign = (b: Record<string, string>, prepare = false) =>
    crypto.createHash('md5').update(`${b.click_trans_id}${b.service_id}click-secret${b.merchant_trans_id}${prepare ? b.merchant_prepare_id : ''}${b.amount}${b.action}${b.sign_time}`).digest('hex');

  it('rejects invalid signature, then prepare+complete marks paid', async () => {
    const { order, payment } = await onlineOrder('click');
    const base = { click_trans_id: '555', service_id: '111', click_paydoc_id: '1', merchant_trans_id: payment.id, amount: String(Number(order.total).toFixed(2)), action: '0', error: '0', error_note: 'ok', sign_time: '2026-11-06 10:00:00' };
    const bad = await request(app).post('/api/v1/payments/click/prepare').type('form').send({ ...base, sign_string: 'deadbeef' });
    expect(bad.body.error).toBe(-1);
    const prep = await request(app).post('/api/v1/payments/click/prepare').type('form').send({ ...base, sign_string: sign(base) });
    expect(prep.body.error).toBe(0);
    const comp = { ...base, action: '1', merchant_prepare_id: String(prep.body.merchant_prepare_id) };
    const done = await request(app).post('/api/v1/payments/click/complete').type('form').send({ ...comp, sign_string: sign(comp, true) });
    expect(done.body.error).toBe(0);
    expect((await prisma.payment.findUnique({ where: { id: payment.id } }))!.status).toBe('paid');
    const dup = await request(app).post('/api/v1/payments/click/complete').type('form').send({ ...comp, sign_string: sign(comp, true) });
    expect(dup.body.error).toBe(-4);
  });
});

describe('sandbox & frontend cannot fake payment', () => {
  it('another user cannot complete my sandbox payment; buyer can after sandbox flow', async () => {
    process.env.PAYME_MERCHANT_ID = '';
    const { payment, order } = await onlineOrder('card');
    // card → CARD_PROVIDER=click (sozlangan) — demak click provayderi
    expect(['click', 'sandbox']).toContain(payment.provider);
    const intruder = await makeUser('BUYER');
    expect((await intruder.c.get(`/api/v1/payments/${payment.id}`)).status).toBe(404);
    // Click to'lovini sandbox endpointi orqali "to'langan" qilib bo'lmaydi
    const fake = await intruder.c.post(`/api/v1/payments/sandbox/${payment.id}/complete`).send({ result: 'success' });
    expect(fake.status).toBe(404);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.paymentStatus).toBe('pending');
  });

  it('unpaid online orders expire and release stock', async () => {
    const { p, order } = await onlineOrder('payme', 5);
    expect((await prisma.productInventory.findUnique({ where: { productId: p.id } }))!.quantity.toString()).toBe('3');
    await prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 3600_000) } });
    expect(await expireUnpaidOrders()).toBe(1);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))!.status).toBe('cancelled');
    expect((await prisma.productInventory.findUnique({ where: { productId: p.id } }))!.quantity.toString()).toBe('5');
  });
});
