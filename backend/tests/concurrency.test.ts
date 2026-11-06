import { beforeEach, describe, expect, it } from 'vitest';
import { checkoutCash, makeCategory, makeProduct, makeUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

describe('inventory concurrency', () => {
  it('two buyers cannot oversell the same stock', async () => {
    const s = await makeUser('SELLER');
    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id, { stock: 5 });
    const buyers = await Promise.all([makeUser('BUYER'), makeUser('BUYER'), makeUser('BUYER'), makeUser('BUYER')]);
    for (const b of buyers) expect((await b.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 5 })).status).toBe(200);
    const results = await Promise.all(buyers.map((b) => checkoutCash(b.c)));
    const okCount = results.filter((r) => r.status === 201).length;
    expect(okCount).toBe(1);
    for (const r of results.filter((x) => x.status !== 201)) {
      expect(r.status).toBe(409);
      expect(['INSUFFICIENT_STOCK', 'CART_ISSUES']).toContain(r.body.error.code);
    }
    const inv = await prisma.productInventory.findUnique({ where: { productId: p.id } });
    expect(inv!.quantity.toString()).toBe('0');
    expect((await prisma.product.findUnique({ where: { id: p.id } }))!.status).toBe('out_of_stock');
    expect(await prisma.order.count()).toBe(1);
  });

  it('parallel partial purchases never drive stock negative', async () => {
    const s = await makeUser('SELLER');
    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id, { stock: 10 });
    const buyers = await Promise.all(Array.from({ length: 6 }, () => makeUser('BUYER')));
    for (const b of buyers) await b.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 3 });
    const results = await Promise.all(buyers.map((b) => checkoutCash(b.c)));
    const okCount = results.filter((r) => r.status === 201).length;
    expect(okCount).toBe(3); // 3 × 3 = 9 ≤ 10
    const inv = await prisma.productInventory.findUnique({ where: { productId: p.id } });
    expect(inv!.quantity.toString()).toBe('1');
  });
});
