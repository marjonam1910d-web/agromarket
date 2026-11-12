import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { audit } from '../../common/audit';
import { qrSvg } from '../../lib/qr';
import { emitToUser } from '../../lib/realtime';
import { notify } from '../notifications/notifications.service';
import { parseIdentifier } from '../auth/auth.service';
import { canonical, contentHash, newSealCode, nextContractNumber, signPayload, verifySignature, verifyUrl, type ContractTerms } from './contracts.service';

/**
 * Elektron oldi-sotdi shartnomasi.
 * Hayot sikli: draft (tomonlar shartlarni kelishadi) → pending (yuborildi, matn muzlatildi, xesh olindi)
 *              → signed (ikkala tomon parol + shaxsiy muhr bilan imzoladi) | rejected | cancelled.
 * Rad etib bo'lmaslik: har bir imzo = HMAC(server kaliti, shartnoma ID | matn xeshi | foydalanuvchi | muhr | vaqt),
 * IP va qurilma bilan birga saqlanadi; imzolangan matn o'zgartirilsa xesh mos kelmaydi va QR sahifa "Haqiqiy emas" ko'rsatadi.
 */
const r = Router();

const DEFAULT_TEXT = {
  deliveryTerms: "Sotuvchi mahsulotni kelishilgan sanada ko'rsatilgan manzilga yetkazib beradi. Mahsulot xaridor tomonidan qabul qilinib, platformada «Yetkazildi» deb tasdiqlangan paytdan boshlab topshirilgan hisoblanadi.",
  paymentTerms: "To'lov AgroMarket platformasi orqali amalga oshiriladi. Onlayn to'lovda mablag' yetkazilgunga qadar platformada saqlanadi va yetkazilgandan so'ng komissiya chegirilgan holda sotuvchi hamyoniga o'tkaziladi.",
  qualityTerms: "Mahsulot yangi, sifatli va O'zbekiston Respublikasining amaldagi sanitariya hamda sifat talablariga mos bo'lishi shart. Sifatsiz mahsulot qabul qilinganidan keyin 24 soat ichida rasm bilan e'tiroz bildirilishi mumkin.",
  disputeResolution: "Nizolar avvalo muzokara va platforma administratori vositachiligida hal qilinadi. Kelishuvga erishilmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq sotuvchi joylashgan hududdagi sudda ko'riladi.",
};

const termsSchema = z.object({
  items: z.array(z.object({ name: z.string().trim().min(1).max(160), quantity: z.number().positive().max(1e7), unit: z.string().max(20), price: z.number().min(0).max(1e10) })).min(1).max(50),
  deliveryAddress: z.string().trim().min(3).max(300),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deliveryTerms: z.string().max(2000).default(DEFAULT_TEXT.deliveryTerms),
  paymentMethod: z.string().max(40).default('platform'),
  paymentTerms: z.string().max(2000).default(DEFAULT_TEXT.paymentTerms),
  prepaymentPercent: z.number().min(0).max(100).default(0),
  qualityTerms: z.string().max(2000).default(DEFAULT_TEXT.qualityTerms),
  penaltyPercentPerDay: z.number().min(0).max(5).default(0.1),
  penaltyMaxPercent: z.number().min(0).max(100).default(10),
  disputeResolution: z.string().max(2000).default(DEFAULT_TEXT.disputeResolution),
  extraTerms: z.string().max(4000).default(''),
});
type TermsInput = z.infer<typeof termsSchema>;

r.use((req, res, next) => (req.path.startsWith('/verify/') ? next() : authenticate(req, res, next)));

const partyUser = { select: { id: true, fullName: true, phone: true, email: true, role: true, buyerProfile: { select: { companyName: true } }, sellerProfile: { select: { farmName: true, tin: true, address: true, region: true, district: true } }, seal: true } } as const;

function view(c: Prisma.ContractGetPayload<{ include: { buyer: typeof partyUser; seller: typeof partyUser; signatures: true } }>, userId?: string) {
  return {
    id: c.id,
    number: c.number,
    publicId: c.publicId,
    verifyUrl: verifyUrl(c.publicId),
    sellerOrderId: c.sellerOrderId,
    title: c.title,
    terms: c.terms,
    totalAmount: c.totalAmount,
    status: c.status,
    contentHash: c.contentHash,
    createdById: c.createdById,
    sentAt: c.sentAt,
    signedAt: c.signedAt,
    rejectedReason: c.rejectedReason,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    myRole: userId ? (c.buyerId === userId ? 'BUYER' : c.sellerUserId === userId ? 'SELLER' : 'ADMIN') : null,
    buyer: { id: c.buyer.id, name: c.buyer.fullName, company: c.buyer.buyerProfile?.companyName ?? null, seal: c.buyer.seal },
    seller: { id: c.seller.id, name: c.seller.fullName, farm: c.seller.sellerProfile?.farmName ?? null, seal: c.seller.seal },
    signatures: c.signatures.map((s) => ({ userId: s.userId, role: s.role, sealCode: s.sealCode, signedAt: s.signedAt, signature: s.signature.slice(0, 16), valid: verifySignature(c.id, s) && s.contentHash === c.contentHash })),
  };
}

async function load(id: string, userId: string, role: string) {
  const c = await prisma.contract.findUnique({ where: { id }, include: { buyer: partyUser, seller: partyUser, signatures: { orderBy: { signedAt: 'asc' } } } });
  if (!c || (c.buyerId !== userId && c.sellerUserId !== userId && role !== 'ADMIN')) throw Errors.notFound('Shartnoma');
  return c;
}

function buildTerms(t: TermsInput, buyer: Awaited<ReturnType<typeof partiesOf>>['buyer'], seller: Awaited<ReturnType<typeof partiesOf>>['seller']): { terms: ContractTerms; total: number } {
  const items = t.items.map((i) => ({ ...i, total: Math.round(i.quantity * i.price * 100) / 100 }));
  const total = Math.round(items.reduce((a, i) => a + i.total, 0) * 100) / 100;
  return {
    total,
    terms: {
      ...t,
      items,
      buyer: { name: buyer.fullName, phone: buyer.phone, email: buyer.email, company: buyer.buyerProfile?.companyName ?? null },
      seller: {
        name: seller.fullName,
        farm: seller.sellerProfile?.farmName ?? seller.fullName,
        tin: seller.sellerProfile?.tin ?? null,
        address: [seller.sellerProfile?.region, seller.sellerProfile?.district, seller.sellerProfile?.address].filter(Boolean).join(', '),
        phone: seller.phone,
      },
    },
  };
}

async function partiesOf(buyerId: string, sellerUserId: string) {
  const [buyer, seller] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: buyerId }, ...partyUser }), prisma.user.findUniqueOrThrow({ where: { id: sellerUserId }, ...partyUser })]);
  return { buyer, seller };
}

async function ensureSeal(userId: string) {
  const existing = await prisma.userSeal.findUnique({ where: { userId } });
  if (existing) return existing;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, sellerProfile: { select: { farmName: true } }, buyerProfile: { select: { companyName: true } } } });
  return prisma.userSeal.create({
    data: { userId, code: newSealCode(), title: u.sellerProfile?.farmName ?? u.buyerProfile?.companyName ?? u.fullName, subtitle: u.fullName },
  });
}

// ───────── Shaxsiy muhr ─────────
r.get('/seal', ah(async (req, res) => ok(res, await prisma.userSeal.findUnique({ where: { userId: req.user!.id } }))));

/** Muhr bir marta yaratiladi va o'zgarmaydi (imzolarning haqiqiyligi uchun) */
r.post(
  '/seal',
  validate({ body: z.object({ title: z.string().trim().min(2).max(60).optional(), color: z.enum(['#1F4D36', '#1E3A8A', '#7F1D1D', '#4C1D95', '#111827']).optional() }) }),
  ah(async (req, res) => {
    const existing = await prisma.userSeal.findUnique({ where: { userId: req.user!.id } });
    if (existing) throw new AppError(409, 'SEAL_EXISTS', "Muhr allaqachon yaratilgan va uni o'zgartirib bo'lmaydi");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { fullName: true, sellerProfile: { select: { farmName: true } }, buyerProfile: { select: { companyName: true } } } });
    const seal = await prisma.userSeal.create({
      data: { userId: req.user!.id, code: newSealCode(), title: req.body.title ?? u.sellerProfile?.farmName ?? u.buyerProfile?.companyName ?? u.fullName, subtitle: u.fullName, color: req.body.color ?? '#1F4D36' },
    });
    await audit(req, 'seal.create', 'UserSeal', seal.code);
    created(res, seal);
  }),
);

// ───────── Ro'yxat va ko'rish ─────────
r.get(
  '/',
  validate({ query: z.object({ status: z.enum(['draft', 'pending', 'signed', 'rejected', 'cancelled']).optional() }) }),
  ah(async (req, res) => {
    const f = q(req) as { status?: 'draft' };
    const uid = req.user!.id;
    const where: Prisma.ContractWhereInput = { ...(req.user!.role === 'ADMIN' ? {} : { OR: [{ buyerId: uid }, { sellerUserId: uid }] }), ...(f.status ? { status: f.status } : {}) };
    const list = await prisma.contract.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200, include: { buyer: partyUser, seller: partyUser, signatures: true } });
    ok(res, list.map((c) => view(c, uid)));
  }),
);

r.get('/:id', ah(async (req, res) => ok(res, view(await load(req.params.id, req.user!.id, req.user!.role), req.user!.id))));

r.get(
  '/:id/qr.svg',
  ah(async (req, res) => {
    const c = await load(req.params.id, req.user!.id, req.user!.role);
    res.type('image/svg+xml').setHeader('Cache-Control', 'private, max-age=3600');
    res.send(qrSvg(verifyUrl(c.publicId), { color: '#123B2A' }));
  }),
);

// ───────── Yaratish ─────────
/** Buyurtmadan: xaridor yoki sotuvchi yaratadi, shartlar avtomatik to'ldiriladi */
r.post(
  '/from-order/:sellerOrderId',
  ah(async (req, res) => {
    const so = await prisma.sellerOrder.findUnique({ where: { id: req.params.sellerOrderId }, include: { items: true, order: true, seller: { select: { userId: true } }, delivery: true } });
    if (!so) throw Errors.notFound('Buyurtma');
    const uid = req.user!.id;
    if (so.order.buyerId !== uid && so.seller.userId !== uid) throw Errors.notFound('Buyurtma');
    if (so.status === 'cancelled') throw new AppError(409, 'ORDER_CANCELLED', 'Bekor qilingan buyurtma uchun shartnoma tuzib bo\'lmaydi');
    const existing = await prisma.contract.findUnique({ where: { sellerOrderId: so.id } });
    if (existing) return ok(res, { id: existing.id, existing: true });
    const { buyer, seller } = await partiesOf(so.order.buyerId, so.seller.userId);
    const input = termsSchema.parse({
      items: so.items.map((i) => ({ name: i.productName, quantity: Number(i.quantity), unit: i.unit, price: Number(i.unitPrice) })),
      deliveryAddress: `${so.order.region}, ${so.order.district}, ${so.order.addressLine}`,
      deliveryDate: so.order.deliveryDate ? so.order.deliveryDate.toISOString().slice(0, 10) : null,
      paymentMethod: so.order.paymentMethod,
      ...(so.order.paymentMethod === 'cash' ? { paymentTerms: "To'lov naqd pulda, mahsulot qabul qilinayotganda to'liq amalga oshiriladi." } : {}),
    });
    const { terms, total } = buildTerms(input, buyer, seller);
    const deliveryFee = Number(so.deliveryFee);
    if (deliveryFee > 0) terms.items.push({ name: 'Yetkazib berish xizmati', quantity: 1, unit: 'xizmat', price: deliveryFee, total: deliveryFee });
    const count = await prisma.contract.count();
    const c = await prisma.contract.create({
      data: {
        number: await nextContractNumber(count),
        publicId: crypto.randomBytes(12).toString('base64url'),
        sellerOrderId: so.id,
        buyerId: so.order.buyerId,
        sellerUserId: so.seller.userId,
        createdById: uid,
        title: `Qishloq xo'jaligi mahsulotlari oldi-sotdi shartnomasi (${so.number})`,
        terms: terms as unknown as Prisma.InputJsonValue,
        totalAmount: new Prisma.Decimal(total + deliveryFee),
      },
    });
    await audit(req, 'contract.create', 'Contract', c.id, { from: 'order' });
    created(res, { id: c.id, existing: false });
  }),
);

/** Erkin shartnoma (masalan ulgurji yoki hosilgacha kelishuv): qarama-qarshi tomon telefon/email orqali topiladi */
r.post(
  '/',
  validate({ body: z.object({ counterpart: z.string().min(5).max(120), title: z.string().trim().min(5).max(200), terms: termsSchema }) }),
  ah(async (req, res) => {
    const me = req.user!;
    if (me.role === 'ADMIN') throw Errors.forbidden('Admin shartnoma tomoni bo\'la olmaydi');
    const { kind, value } = parseIdentifier(req.body.counterpart);
    const other = await prisma.user.findFirst({ where: { ...(kind === 'phone' ? { phone: value } : { email: value }), status: 'ACTIVE', deletedAt: null } });
    if (!other || other.id === me.id) throw new AppError(404, 'COUNTERPART_NOT_FOUND', 'Bunday foydalanuvchi topilmadi');
    const iAmSeller = me.role === 'SELLER';
    const buyerId = iAmSeller ? other.id : me.id;
    const sellerUserId = iAmSeller ? me.id : other.id;
    const sellerUser = await prisma.user.findUnique({ where: { id: sellerUserId }, select: { role: true } });
    if (sellerUser?.role !== 'SELLER') throw new AppError(400, 'COUNTERPART_ROLE', "Shartnomaning bir tomoni fermer (sotuvchi) bo'lishi kerak");
    const { buyer, seller } = await partiesOf(buyerId, sellerUserId);
    const { terms, total } = buildTerms(req.body.terms, buyer, seller);
    const count = await prisma.contract.count();
    const c = await prisma.contract.create({
      data: {
        number: await nextContractNumber(count),
        publicId: crypto.randomBytes(12).toString('base64url'),
        buyerId,
        sellerUserId,
        createdById: me.id,
        title: req.body.title,
        terms: terms as unknown as Prisma.InputJsonValue,
        totalAmount: new Prisma.Decimal(total),
      },
    });
    await audit(req, 'contract.create', 'Contract', c.id, { from: 'custom' });
    created(res, { id: c.id });
  }),
);

/** Qoralama yoki rad etilgan shartnomani tahrirlash (faqat tomonlar) */
r.patch(
  '/:id',
  validate({ body: z.object({ title: z.string().trim().min(5).max(200).optional(), terms: termsSchema }) }),
  ah(async (req, res) => {
    const c = await load(req.params.id, req.user!.id, req.user!.role);
    if (req.user!.role === 'ADMIN') throw Errors.forbidden();
    if (!['draft', 'rejected'].includes(c.status)) throw new AppError(409, 'CONTRACT_LOCKED', "Yuborilgan shartnomani o'zgartirib bo'lmaydi");
    const { buyer, seller } = await partiesOf(c.buyerId, c.sellerUserId);
    const { terms, total } = buildTerms(req.body.terms, buyer, seller);
    await prisma.contract.update({
      where: { id: c.id },
      data: { title: req.body.title ?? c.title, terms: terms as unknown as Prisma.InputJsonValue, totalAmount: new Prisma.Decimal(total), status: 'draft', rejectedReason: null, rejectedById: null, contentHash: null },
    });
    ok(res, view(await load(c.id, req.user!.id, req.user!.role), req.user!.id));
  }),
);

/** Imzolashga yuborish: matn muzlatiladi va xesh olinadi */
r.post(
  '/:id/send',
  ah(async (req, res) => {
    const c = await load(req.params.id, req.user!.id, req.user!.role);
    if (req.user!.role === 'ADMIN') throw Errors.forbidden();
    if (!['draft', 'rejected'].includes(c.status)) throw new AppError(409, 'CONTRACT_LOCKED', 'Shartnoma allaqachon yuborilgan');
    const hash = contentHash(c);
    await prisma.contract.update({ where: { id: c.id }, data: { status: 'pending', contentHash: hash, sentAt: new Date(), rejectedReason: null } });
    const other = c.buyerId === req.user!.id ? c.sellerUserId : c.buyerId;
    const me = c.buyerId === req.user!.id ? c.buyer.fullName : (c.seller.sellerProfile?.farmName ?? c.seller.fullName);
    void notify({ userId: other, type: 'contract', key: 'contract.received', params: { from: me, number: c.number }, link: `/contracts/${c.id}` });
    emitToUser(other, { type: 'contract_update', payload: { id: c.id, status: 'pending' } });
    await audit(req, 'contract.send', 'Contract', c.id, { hash });
    ok(res, view(await load(c.id, req.user!.id, req.user!.role), req.user!.id));
  }),
);

/** Imzolash: parol bilan tasdiqlanadi, shaxsiy muhr bosiladi. Qaytarib bo'lmaydi. */
r.post(
  '/:id/sign',
  authLimiter(),
  validate({ body: z.object({ password: z.string().min(1).max(128), agree: z.literal(true) }) }),
  ah(async (req, res) => {
    const uid = req.user!.id;
    const c = await load(req.params.id, uid, req.user!.role);
    if (c.buyerId !== uid && c.sellerUserId !== uid) throw Errors.forbidden();
    if (c.status !== 'pending' || !c.contentHash) throw new AppError(409, 'CONTRACT_NOT_PENDING', "Shartnoma imzolash bosqichida emas");
    if (c.signatures.some((s) => s.userId === uid)) throw new AppError(409, 'ALREADY_SIGNED', 'Siz allaqachon imzolagansiz');
    // Matn yuborilgandan keyin o'zgarmaganini tekshirish
    if (contentHash(c) !== c.contentHash) throw new AppError(409, 'CONTRACT_TAMPERED', "Shartnoma matni o'zgargan. Imzolash to'xtatildi");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: uid }, select: { passwordHash: true } });
    if (!u.passwordHash || !(await bcrypt.compare(req.body.password, u.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', "Parol noto'g'ri");
    const seal = await ensureSeal(uid);
    const at = new Date();
    const role = c.buyerId === uid ? 'BUYER' : 'SELLER';
    await prisma.$transaction(async (tx) => {
      await tx.contractSignature.create({
        data: { contractId: c.id, userId: uid, role, sealCode: seal.code, contentHash: c.contentHash!, signature: signPayload(c.id, c.contentHash!, uid, seal.code, at), ip: req.ip ?? null, userAgent: req.get('user-agent')?.slice(0, 250) ?? null, signedAt: at },
      });
      const n = await tx.contractSignature.count({ where: { contractId: c.id } });
      if (n >= 2) await tx.contract.update({ where: { id: c.id }, data: { status: 'signed', signedAt: at } });
    });
    await audit(req, 'contract.sign', 'Contract', c.id, { role, seal: seal.code, hash: c.contentHash });
    const fresh = await load(c.id, uid, req.user!.role);
    for (const p of [c.buyerId, c.sellerUserId]) emitToUser(p, { type: 'contract_update', payload: { id: c.id, status: fresh.status } });
    if (fresh.status === 'signed') for (const p of [c.buyerId, c.sellerUserId]) void notify({ userId: p, type: 'contract', key: 'contract.signed', params: { number: c.number }, link: `/contracts/${c.id}` });
    ok(res, view(fresh, uid));
  }),
);

r.post(
  '/:id/reject',
  validate({ body: z.object({ reason: z.string().trim().min(3).max(500) }) }),
  ah(async (req, res) => {
    const uid = req.user!.id;
    const c = await load(req.params.id, uid, req.user!.role);
    if (c.buyerId !== uid && c.sellerUserId !== uid) throw Errors.forbidden();
    if (c.status !== 'pending') throw new AppError(409, 'CONTRACT_NOT_PENDING', "Faqat imzolash bosqichidagi shartnomani rad etish mumkin");
    await prisma.$transaction([
      prisma.contractSignature.deleteMany({ where: { contractId: c.id } }),
      prisma.contract.update({ where: { id: c.id }, data: { status: 'rejected', rejectedById: uid, rejectedReason: req.body.reason } }),
    ]);
    const other = c.buyerId === uid ? c.sellerUserId : c.buyerId;
    void notify({ userId: other, type: 'contract', key: 'contract.rejected', params: { number: c.number, reason: req.body.reason }, link: `/contracts/${c.id}` });
    await audit(req, 'contract.reject', 'Contract', c.id, { reason: req.body.reason });
    ok(res, view(await load(c.id, uid, req.user!.role), uid));
  }),
);

r.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const uid = req.user!.id;
    const c = await load(req.params.id, uid, req.user!.role);
    if (c.createdById !== uid) throw Errors.forbidden('Faqat shartnomani tuzgan tomon bekor qila oladi');
    if (c.status === 'signed') throw new AppError(409, 'CONTRACT_SIGNED', "Imzolangan shartnomani bekor qilib bo'lmaydi");
    if (c.signatures.length) throw new AppError(409, 'CONTRACT_PARTLY_SIGNED', "Bir tomon imzolagan — avval rad etilishi kerak");
    await prisma.contract.update({ where: { id: c.id }, data: { status: 'cancelled' } });
    await audit(req, 'contract.cancel', 'Contract', c.id);
    ok(res, { ok: true });
  }),
);

// ───────── Ommaviy tekshiruv (QR) ─────────
const mask = (s: string | null | undefined) => (s ? s.replace(/^(\+?\d{5})\d+(\d{2})$/, '$1*****$2') : null);

r.get(
  '/verify/:publicId',
  ah(async (req, res) => {
    const c = await prisma.contract.findUnique({ where: { publicId: req.params.publicId }, include: { buyer: partyUser, seller: partyUser, signatures: { orderBy: { signedAt: 'asc' } } } });
    if (!c) throw Errors.notFound('Shartnoma');
    const hashOk = Boolean(c.contentHash) && contentHash(c) === c.contentHash;
    const sigs = c.signatures.map((s) => ({ role: s.role, sealCode: s.sealCode, signedAt: s.signedAt, valid: verifySignature(c.id, s) && s.contentHash === c.contentHash }));
    const t = c.terms as unknown as ContractTerms;
    ok(res, {
      number: c.number,
      title: c.title,
      status: c.status,
      totalAmount: c.totalAmount,
      createdAt: c.createdAt,
      signedAt: c.signedAt,
      contentHash: c.contentHash,
      integrity: c.status === 'signed' ? hashOk && sigs.length >= 2 && sigs.every((s) => s.valid) : null,
      buyer: { name: c.buyer.fullName, company: t.buyer?.company ?? null, phone: mask(c.buyer.phone), seal: c.buyer.seal },
      seller: { name: c.seller.fullName, farm: t.seller?.farm ?? null, phone: mask(c.seller.phone), seal: c.seller.seal },
      items: t.items,
      signatures: sigs,
      canonicalSize: canonical(c.terms).length,
    });
  }),
);

r.get(
  '/verify/:publicId/qr.svg',
  ah(async (req, res) => {
    const c = await prisma.contract.findUnique({ where: { publicId: req.params.publicId }, select: { publicId: true } });
    if (!c) throw Errors.notFound('Shartnoma');
    res.type('image/svg+xml').setHeader('Cache-Control', 'public, max-age=86400');
    res.send(qrSvg(verifyUrl(c.publicId), { color: '#123B2A' }));
  }),
);

export default r;
