import { beforeEach, describe, expect, it } from 'vitest';
import { address, checkoutCash, client, makeCategory, makeProduct, makeUser, prisma, resetDb, tomorrow } from './helpers';

beforeEach(resetDb);

describe('seller verification & product moderation', () => {
  it('unverified seller cannot publish; admin approves seller and product', async () => {
    const admin = await makeUser('ADMIN');
    const seller = await makeUser('SELLER', { approved: false });
    const cat = await makeCategory();
    const body = {
      name: 'Bodring', description: 'Qarsildoq bodring, issiqxona', categoryId: cat.id, price: 9000, unit: 'kg', stock: 100,
      region: 'namangan', district: 'Chust', images: [],
    };
    const denied = await seller.c.post('/api/v1/products').send(body);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('SELLER_NOT_VERIFIED');
    const draft = await seller.c.post('/api/v1/products').send({ ...body, submit: false });
    expect(draft.status).toBe(201);
    expect(draft.body.data.status).toBe('draft');

    // buyer cannot access admin endpoints
    const buyer = await makeUser('BUYER');
    expect((await buyer.c.post(`/api/v1/admin/sellers/${seller.sellerId}/verify`).send({ decision: 'APPROVED' })).status).toBe(403);

    const approve = await admin.c.post(`/api/v1/admin/sellers/${seller.sellerId}/verify`).send({ decision: 'APPROVED' });
    expect(approve.status).toBe(200);
    const log = await prisma.auditLog.findFirst({ where: { action: 'seller.approved' } });
    expect(log?.actorId).toBe(admin.user.id);

    const submit = await seller.c.patch(`/api/v1/products/${draft.body.data.id}/visibility`).send({ action: 'submit' });
    expect(submit.body.data.status).toBe('pending_review');
    const before = await client().then((c) => c.get('/api/v1/products'));
    expect(before.body.data).toHaveLength(0);
    const mod = await admin.c.post(`/api/v1/admin/products/${draft.body.data.id}/moderate`).send({ decision: 'approve' });
    expect(mod.body.data.status).toBe('active');
    const after = await client().then((c) => c.get('/api/v1/products'));
    expect(after.body.data).toHaveLength(1);
  });

  it('seller cannot edit another seller product', async () => {
    const s1 = await makeUser('SELLER');
    const s2 = await makeUser('SELLER');
    const cat = await makeCategory();
    const p = await makeProduct(s1.sellerId!, cat.id);
    const r = await s2.c.patch(`/api/v1/products/${p.id}/stock`).send({ quantity: 0 });
    expect(r.status).toBe(404);
  });
});

describe('search & filters (server-side)', () => {
  it('filters by query, price range, region and sorts', async () => {
    const s = await makeUser('SELLER');
    const cat = await makeCategory();
    await makeProduct(s.sellerId!, cat.id, { name: 'Pomidor qizil', price: 12000 });
    await makeProduct(s.sellerId!, cat.id, { name: 'Bodring', price: 8000 });
    await makeProduct(s.sellerId!, cat.id, { name: 'Kartoshka', price: 5000 });
    const c = await client();
    expect((await c.get('/api/v1/products?q=pomidor')).body.data).toHaveLength(1);
    expect((await c.get('/api/v1/products?minPrice=6000&maxPrice=10000')).body.data.map((p: { name: string }) => p.name)).toEqual(['Bodring']);
    const asc = await c.get('/api/v1/products?sort=price_asc');
    expect(asc.body.data.map((p: { name: string }) => p.name)).toEqual(['Kartoshka', 'Bodring', 'Pomidor qizil']);
    expect((await c.get('/api/v1/products?region=andijon')).body.data).toHaveLength(0);
    expect((await c.get(`/api/v1/products?category=${cat.slug}&limit=2`)).body.meta).toMatchObject({ total: 3, pages: 2 });
  });
});

describe('cart → checkout → order lifecycle → review', () => {
  it('full happy path with cash payment', async () => {
    const seller = await makeUser('SELLER');
    const buyer = await makeUser('BUYER');
    const other = await makeUser('BUYER');
    const cat = await makeCategory();
    const p = await makeProduct(seller.sellerId!, cat.id, { stock: 10, price: 10000 });

    const tooMuch = await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 11 });
    expect(tooMuch.status).toBe(409);
    const add = await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 4 });
    expect(add.status).toBe(200);
    expect(add.body.data.subtotal).toBe('40000');

    const quote = await buyer.c.get('/api/v1/cart?region=toshkent-sh&district=Chilonzor');
    expect(quote.body.data.deliveryFee).toBe('22000'); // 20000 + 4kg × 500
    expect(quote.body.data.total).toBe('62000');

    const co = await checkoutCash(buyer.c);
    expect(co.status).toBe(201);
    const orderId = co.body.data.order.id;
    expect((await prisma.productInventory.findUnique({ where: { productId: p.id } }))!.quantity.toString()).toBe('6');
    expect((await buyer.c.get('/api/v1/cart')).body.data.itemCount).toBe(0);

    // boshqa xaridor bu buyurtmani ko'ra olmaydi
    expect((await other.c.get(`/api/v1/orders/${orderId}`)).status).toBe(404);

    const list = await seller.c.get('/api/v1/orders/seller/list');
    expect(list.body.data).toHaveLength(1);
    const soId = list.body.data[0].id;

    // noto'g'ri o'tish
    const jump = await seller.c.post(`/api/v1/orders/seller/${soId}/status`).send({ status: 'shipped' });
    expect(jump.status).toBe(409);
    for (const status of ['confirmed', 'preparing', 'ready_for_delivery']) {
      const r = await seller.c.post(`/api/v1/orders/seller/${soId}/status`).send({ status });
      expect(r.status).toBe(200);
    }
    const noCourier = await seller.c.post(`/api/v1/orders/seller/${soId}/status`).send({ status: 'shipped' });
    expect(noCourier.status).toBe(422);
    expect((await seller.c.post(`/api/v1/orders/seller/${soId}/status`).send({ status: 'shipped', courierName: 'Kuryer', courierPhone: '909876543' })).status).toBe(200);

    // yetkazilmasdan sharh yozib bo'lmaydi
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    expect((await buyer.c.post('/api/v1/reviews').send({ orderItemId: items[0].id, rating: 5 })).status).toBe(403);

    // xaridor tracking
    const track = await buyer.c.get(`/api/v1/orders/${orderId}`);
    expect(track.body.data.sellerOrders[0].delivery.status).toBe('in_transit');
    expect(track.body.data.sellerOrders[0].delivery.courierPhone).toBe('+998909876543');

    expect((await buyer.c.post(`/api/v1/orders/seller-orders/${soId}/receive`)).status).toBe(200);
    const done = await prisma.order.findUnique({ where: { id: orderId } });
    expect(done!.status).toBe('delivered');
    expect(done!.paymentStatus).toBe('paid'); // naqd — yetkazilganda to'langan

    const rv = await buyer.c.post('/api/v1/reviews').send({ orderItemId: items[0].id, rating: 4, text: 'Yaxshi' });
    expect(rv.status).toBe(201);
    expect((await buyer.c.post('/api/v1/reviews').send({ orderItemId: items[0].id, rating: 5 })).status).toBe(409);
    const prod = await prisma.product.findUnique({ where: { id: p.id } });
    expect(prod!.ratingAvg.toString()).toBe('4');
    expect(prod!.soldCount.toString()).toBe('4');
    // boshqa xaridor sharh qoldira olmaydi
    expect((await other.c.post('/api/v1/reviews').send({ orderItemId: items[1]?.id ?? items[0].id, rating: 1 })).status).toBe(404);
  });

  it('multi-seller cart splits into seller suborders under one parent order', async () => {
    const s1 = await makeUser('SELLER');
    const s2 = await makeUser('SELLER');
    const buyer = await makeUser('BUYER');
    const cat = await makeCategory();
    const p1 = await makeProduct(s1.sellerId!, cat.id, { price: 10000 });
    const p2 = await makeProduct(s2.sellerId!, cat.id, { price: 20000 });
    await buyer.c.post('/api/v1/cart/items').send({ productId: p1.id, quantity: 1 });
    await buyer.c.post('/api/v1/cart/items').send({ productId: p2.id, quantity: 1 });
    const co = await checkoutCash(buyer.c);
    expect(co.status).toBe(201);
    const sos = await prisma.sellerOrder.findMany({ where: { orderId: co.body.data.order.id } });
    expect(sos).toHaveLength(2);
    expect(sos.every((s) => s.commissionAmount.greaterThan(0))).toBe(true);
    // s1 faqat o'z qismini ko'radi
    const view = await s1.c.get(`/api/v1/orders/${co.body.data.order.id}`);
    expect(view.body.data.sellerOrders).toHaveLength(1);
  });

  it('buyer cancel restores stock; idempotency key prevents duplicate orders', async () => {
    const s = await makeUser('SELLER');
    const buyer = await makeUser('BUYER');
    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id, { stock: 10 });
    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 3 });
    const body = { address, deliveryDate: tomorrow(), deliverySlot: '15:00-18:00', paymentMethod: 'cash', termsAccepted: true };
    const a = await buyer.c.post('/api/v1/orders/checkout').set('Idempotency-Key', 'abc-1').send(body);
    const b = await buyer.c.post('/api/v1/orders/checkout').set('Idempotency-Key', 'abc-1').send(body);
    expect(a.status).toBe(201);
    expect(b.body.data.replay).toBe(true);
    expect(b.body.data.order.id).toBe(a.body.data.order.id);
    expect(await prisma.order.count()).toBe(1);
    const cancel = await buyer.c.post(`/api/v1/orders/${a.body.data.order.id}/cancel`).send({ reason: "Fikrimni o'zgartirdim" });
    expect(cancel.status).toBe(200);
    expect((await prisma.productInventory.findUnique({ where: { productId: p.id } }))!.quantity.toString()).toBe('10');
  });

  it('rejects delivery date in the past and unknown slot', async () => {
    const s = await makeUser('SELLER');
    const buyer = await makeUser('BUYER');
    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id);
    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 1 });
    const past = await buyer.c.post('/api/v1/orders/checkout').send({ address, deliveryDate: '2020-01-01', deliverySlot: '15:00-18:00', paymentMethod: 'cash', termsAccepted: true });
    expect(past.status).toBe(422);
    const slot = await buyer.c.post('/api/v1/orders/checkout').send({ address, deliveryDate: tomorrow(), deliverySlot: '01:00-02:00', paymentMethod: 'cash', termsAccepted: true });
    expect(slot.status).toBe(400);
  });
});
