import { beforeEach, describe, expect, it } from 'vitest';
import { checkoutCash, client, makeCategory, makeProduct, makeUser, prisma, resetDb } from './helpers';

beforeEach(resetDb);

async function admin() {
  return makeUser('ADMIN');
}

const sellerForm = (uid: string) => ({
  data: {
    fullName: 'Aliyev Javohir Karimovich', position: 'rahbari', phone: '+998911234567', email: null, legalForm: 'fermer', farmName: "Bog'iston", tin: '305123456',
    regNumber: 'FX-1234', regDate: '2019-03-14', region: 'namangan', district: 'Chust', address: "Bog'iston MFY, 12-uy", landArea: 4.5, employees: 6, activity: ['Mevalar'], extra: '',
  },
  attachments: [{ key: `private/docs/${uid}/a.pdf`, name: 'Guvohnoma', type: 'certificate' }],
  agree: true,
});

describe('E-arizalar', () => {
  it("fermer arizasi: parol bilan, muhr bosiladi; admin tasdiqlaydi → xo'jalik tasdiqlanadi", async () => {
    const s = await makeUser('SELLER', { approved: false });
    const a = await admin();
    expect((await s.c.post('/api/v1/applications/seller').send({ ...sellerForm(s.user.id), password: 'wrong' })).status).toBe(400);
    // boshqa foydalanuvchining hujjatini ilova qilib bo'lmaydi
    expect((await s.c.post('/api/v1/applications/seller').send({ ...sellerForm('someone-else'), password: s.password })).status).toBe(403);
    const r = await s.c.post('/api/v1/applications/seller').send({ ...sellerForm(s.user.id), password: s.password });
    expect(r.status).toBe(201);
    expect(r.body.data.sealCode).toMatch(/^AM-/);
    expect(r.body.data.contentHash).toHaveLength(64);
    expect((await s.c.post('/api/v1/applications/seller').send({ ...sellerForm(s.user.id), password: s.password })).status).toBe(409);
    const list = await a.c.get('/api/v1/applications?status=pending');
    expect(list.body.data).toHaveLength(1);
    expect((await s.c.get('/api/v1/applications')).status).toBe(403);
    expect((await a.c.post(`/api/v1/applications/${r.body.data.id}/review`).send({ decision: 'approve' })).status).toBe(200);
    const sp = await prisma.sellerProfile.findUniqueOrThrow({ where: { id: s.sellerId! } });
    expect(sp.verificationStatus).toBe('APPROVED');
    expect(sp.tin).toBe('305123456');
  });

  it("mahsulotlar paketi: bitta ariza, admin tanlaganlari tasdiqlanadi, qolgani rad etiladi; taklif qilingan kategoriya faollashadi", async () => {
    const s = await makeUser('SELLER');
    const a = await admin();
    const cat = await makeCategory();
    const proposed = await s.c.post('/api/v1/applications/categories').send({ nameUz: 'Qo\'ziqorinlar' });
    expect(proposed.status).toBe(201);
    expect(proposed.body.data.isActive).toBe(false);
    const up = await s.c.post('/api/v1/uploads/images?folder=products').attach('files', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), 'a.png');
    expect(up.status).toBe(201);
    const img = { url: up.body.data[0].url, thumbUrl: up.body.data[0].thumbUrl };
    const item = (name: string, categoryId: string) => ({ name, categoryId, description: 'Yangi hosil, sifatli mahsulot', price: 12000, unit: 'kg', stock: 100, minOrderQty: 1, images: [img] });
    const r = await s.c.post('/api/v1/applications/products').send({ items: [item('Pomidor', cat.id), item('Bodring', cat.id), item('Qo\'ziqorin', proposed.body.data.id)], password: s.password, agree: true });
    expect(r.status).toBe(201);
    expect(r.body.data.items).toHaveLength(3);
    const detail = await a.c.get(`/api/v1/applications/${r.body.data.id}`);
    const byName = Object.fromEntries(detail.body.data.items.map((i: { id: string; product: { name: string } }) => [i.product.name, i.id]));
    const rev = await a.c.post(`/api/v1/applications/${r.body.data.id}/review`).send({ decision: 'approve', approveItemIds: [byName.Pomidor, byName["Qo'ziqorin"]], itemNotes: { [byName.Bodring]: 'Rasm sifatsiz' } });
    expect(rev.body.data.status).toBe('partially_approved');
    const ps = await prisma.product.findMany({ where: { sellerId: s.sellerId! }, select: { name: true, status: true, rejectionReason: true } });
    expect(ps.find((p) => p.name === 'Pomidor')?.status).toBe('active');
    expect(ps.find((p) => p.name === 'Bodring')).toMatchObject({ status: 'rejected', rejectionReason: 'Rasm sifatsiz' });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: proposed.body.data.id } })).isActive).toBe(true);
  });
});

describe("Hamkorlik, xodimlar va kuryer", () => {
  it("hamkorlik tasdiqlangach fermer kuryerni email kodi bilan qo'shadi; kuryer yetkazadi; platforma ulushi yechiladi", async () => {
    const s = await makeUser('SELLER');
    const a = await admin();
    expect((await s.c.post('/api/v1/staff/invite').send({ email: 'k@test.uz', role: 'COURIER' })).status).toBe(403);
    const app = await s.c.post('/api/v1/applications/partnership').send({ couriers: 2, vehicles: 'Damas', regions: ['namangan'], password: s.password, agree: true });
    expect(app.status).toBe(201);
    const rev = await a.c.post(`/api/v1/applications/${app.body.data.id}/review`).send({ decision: 'approve', sharePercent: 20 });
    expect(rev.body.data.partnership).toMatch(/^HM-/);

    const courier = await makeUser('BUYER');
    await prisma.user.update({ where: { id: courier.user.id }, data: { email: 'k@test.uz' } });
    expect((await s.c.post('/api/v1/staff/invite').send({ email: 'none@test.uz', role: 'COURIER' })).status).toBe(404);
    const inv = await s.c.post('/api/v1/staff/invite').send({ email: 'k@test.uz', role: 'COURIER' });
    expect(inv.status).toBe(201);
    const code = inv.body.data.devCode as string;
    expect(code).toMatch(/^\d{6}$/);
    expect((await courier.c.post('/api/v1/staff/accept').send({ inviteId: inv.body.data.id, code: code === '000000' ? '111111' : '000000' })).status).toBe(400);
    expect((await courier.c.post('/api/v1/staff/accept').send({ inviteId: inv.body.data.id, code })).status).toBe(200);
    expect((await courier.c.get('/api/v1/staff/me')).body.data[0].status).toBe('active');

    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id, { stock: 100, price: 20000 });
    const buyer = await makeUser('BUYER');
    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 5 });
    const co = await checkoutCash(buyer.c, 'cash');
    const so = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId: co.body.data.order.id } });
    await prisma.sellerOrder.update({ where: { id: so.id }, data: { deliveryFee: 30000 } });
    for (const status of ['confirmed', 'preparing', 'ready_for_delivery']) await s.c.post(`/api/v1/orders/seller/${so.id}/status`).send({ status });
    expect((await s.c.post(`/api/v1/staff/assign/${so.id}`).send({ staffId: inv.body.data.id })).status).toBe(200);
    const work = await courier.c.get('/api/v1/staff/work/deliveries');
    expect(work.body.data).toHaveLength(1);
    expect((await courier.c.post(`/api/v1/staff/work/deliveries/${so.id}/delivered`)).status).toBe(409);
    expect((await courier.c.post(`/api/v1/staff/work/deliveries/${so.id}/ship`)).status).toBe(200);
    expect((await courier.c.post(`/api/v1/maps/tracking/${so.id}/start`).send({ lat: 41, lng: 71.2 })).status).toBe(200);
    expect((await courier.c.post(`/api/v1/staff/work/deliveries/${so.id}/delivered`)).status).toBe(200);
    const share = await prisma.walletTransaction.findFirst({ where: { userId: s.user.id, kind: 'partner_share' } });
    expect(Number(share?.amount)).toBe(-6000);
    // begona foydalanuvchi kuryer amalini bajara olmaydi
    const other = await makeUser('BUYER');
    expect((await other.c.post(`/api/v1/staff/work/deliveries/${so.id}/ship`)).status).toBe(404);
  });
});

describe('Admin: foydalanuvchi kartasi va choralar', () => {
  it("tahrirlash dalolatnoma bilan, parolni almashtirish sessiyalarni yopadi; jarima hamyondan yechiladi, bekor qilinsa qaytadi", async () => {
    const s = await makeUser('SELLER');
    const a = await admin();
    expect((await s.c.get(`/api/v1/backoffice/users/${s.user.id}`)).status).toBe(403);
    const card = await a.c.get(`/api/v1/backoffice/users/${s.user.id}`);
    expect(card.status).toBe(200);
    expect(card.body.data.sellerProfile.farmName).toBeTruthy();
    const ed = await a.c.patch(`/api/v1/backoffice/users/${s.user.id}`).send({ fullName: 'Yangi Ism', seller: { tin: '123456789' }, reason: 'Hujjat bo\'yicha' });
    expect(ed.body.data).toMatchObject({ changed: 2 });
    expect(ed.body.data.act).toMatch(/^TZ-/);
    expect((await a.c.post(`/api/v1/backoffice/users/${s.user.id}/password`).send({ password: 'NewPass2026x' })).status).toBe(200);
    expect((await s.c.get('/api/v1/auth/me')).status).toBe(401);
    const relog = await (await client()).post('/api/v1/auth/login').send({ login: s.phone, password: 'NewPass2026x' });
    expect(relog.status).toBe(200);

    const fine = await a.c.post('/api/v1/backoffice/sanctions').send({ userId: s.user.id, kind: 'fine', amount: 50000, reason: 'Sifatsiz mahsulot yetkazildi' });
    expect(fine.status).toBe(201);
    expect(fine.body.data.number).toMatch(/^JR-/);
    const tx = await prisma.walletTransaction.findFirstOrThrow({ where: { userId: s.user.id, kind: 'penalty' } });
    expect(Number(tx.amount)).toBe(-50000);
    const doc = await a.c.get(`/api/v1/documents/sanction/${fine.body.data.id}`);
    expect(doc.body.data.platformSeal.code).toMatch(/^AM-/);
    expect((await a.c.post(`/api/v1/backoffice/sanctions/${fine.body.data.id}/cancel`).send({ reason: 'Xato' })).status).toBe(200);
    const sum = await prisma.walletTransaction.aggregate({ where: { userId: s.user.id }, _sum: { amount: true } });
    expect(Number(sum._sum.amount)).toBe(0);
  });

  it("hisob-faktura faqat tomonlarga; to'lov cheki adminga; hisobotlar fermer uchun faqat o'z xo'jaligi", async () => {
    const s = await makeUser('SELLER');
    const s2 = await makeUser('SELLER');
    const a = await admin();
    const cat = await makeCategory();
    const p = await makeProduct(s.sellerId!, cat.id, { stock: 100, price: 15000 });
    const p2 = await makeProduct(s2.sellerId!, cat.id, { stock: 100, price: 9000 });
    const buyer = await makeUser('BUYER');
    await buyer.c.post('/api/v1/cart/items').send({ productId: p.id, quantity: 4 });
    await buyer.c.post('/api/v1/cart/items').send({ productId: p2.id, quantity: 2 });
    const co = await checkoutCash(buyer.c, 'cash');
    const so = await prisma.sellerOrder.findFirstOrThrow({ where: { orderId: co.body.data.order.id, sellerId: s.sellerId! } });
    const inv = await buyer.c.get(`/api/v1/documents/invoice/${so.id}`);
    expect(inv.status).toBe(200);
    expect(inv.body.data.number).toBe(`HF-${so.number}`);
    expect(inv.body.data.sellerSeal.code).toMatch(/^AM-/);
    expect((await s2.c.get(`/api/v1/documents/invoice/${so.id}`)).status).toBe(403);
    const pay = await prisma.payment.findFirstOrThrow({ where: { orderId: co.body.data.order.id } });
    expect((await a.c.get(`/api/v1/backoffice/payments/${pay.id}/receipt`)).body.data.receipt.items).toHaveLength(2);
    const mine = await s.c.get('/api/v1/reports/lines?days=7');
    expect(mine.body.data.rows).toHaveLength(1);
    expect(mine.body.data.totals.revenue).toBe(60000);
    expect((await a.c.get('/api/v1/reports/lines?days=7')).body.data.rows).toHaveLength(2);
    const csv = await s.c.get('/api/v1/reports/lines/export?days=7');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Mahsulot');
    expect((await buyer.c.get('/api/v1/reports/lines')).status).toBe(403);
  });
});

describe("Admin: hamyonga qo'lda o'tkazma", () => {
  it("musbat qo'shiladi, manfiy balansdan oshsa rad etiladi, fermer bo'lmasa 404", async () => {
    const s = await makeUser('SELLER');
    const b = await makeUser('BUYER');
    const a = await admin();
    expect((await s.c.post('/api/v1/wallet/admin/adjust').send({ userId: s.user.id, amount: 1000, note: 'test' })).status).toBe(403);
    expect((await a.c.post('/api/v1/wallet/admin/adjust').send({ userId: s.user.id, amount: 200000, note: "Demo to'lov" })).status).toBe(201);
    expect((await a.c.post('/api/v1/wallet/admin/adjust').send({ userId: s.user.id, amount: -300000, note: 'Ortiqcha' })).status).toBe(409);
    expect((await a.c.post('/api/v1/wallet/admin/adjust').send({ userId: b.user.id, amount: 1000, note: 'Xaridor' })).status).toBe(404);
    const w = await s.c.get('/api/v1/wallet');
    expect(Number(w.body.data.balance.available)).toBe(200000);
  });
});
