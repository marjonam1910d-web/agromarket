import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ah, ok, created, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { normalizePhone, PHONE_RE } from '../../common/utils';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { storage } from '../../lib/storage';
import { audit } from '../../common/audit';
import { hashPassword, publicUser, revokeAllSessions } from '../auth/auth.service';
import { passwordSchema } from '../auth/auth.routes';

const r = Router();
r.use(authenticate);

r.patch(
  '/me',
  validate({
    body: z.object({
      fullName: z.string().trim().min(3).max(100).optional(),
      locale: z.enum(['uz', 'ru', 'en']).optional(),
      avatarUrl: z.string().url().nullable().optional(),
      buyer: z.object({ isWholesale: z.boolean().optional(), companyName: z.string().max(120).nullable().optional() }).optional(),
    }),
  }),
  ah(async (req, res) => {
    const { buyer, avatarUrl, ...rest } = req.body;
    if (avatarUrl && !storage.isOwnPublicUrl(avatarUrl)) throw Errors.badRequest('Rasm faqat platforma orqali yuklanadi');
    await prisma.user.update({ where: { id: req.user!.id }, data: { ...rest, ...(avatarUrl !== undefined ? { avatarUrl } : {}) } });
    if (buyer && req.user!.role === 'BUYER') {
      await prisma.buyerProfile.upsert({
        where: { userId: req.user!.id },
        update: buyer,
        create: { userId: req.user!.id, isWholesale: buyer.isWholesale ?? false, companyName: buyer.companyName ?? null },
      });
    }
    ok(res, await publicUser(req.user!.id));
  }),
);

r.post(
  '/me/password',
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema }) }),
  ah(async (req, res) => {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) {
      throw Errors.badRequest("Joriy parol noto'g'ri");
    }
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(req.body.newPassword) } });
    await revokeAllSessions(u.id);
    await audit(req, 'user.password_change', 'User', u.id);
    ok(res, { ok: true, reloginRequired: true });
  }),
);

// ───────── Manzillar ─────────
const addressSchema = z
  .object({
    label: z.string().trim().min(1).max(30).default('Uy'),
    recipientName: z.string().trim().min(2).max(100),
    phone: z.string().transform((v, ctx) => {
      const p = normalizePhone(v);
      if (!p || !PHONE_RE.test(p)) {
        ctx.addIssue({ code: 'custom', message: "Telefon raqam noto'g'ri" });
        return z.NEVER;
      }
      return p;
    }),
    region: z.string(),
    district: z.string(),
    street: z.string().trim().min(3).max(250),
    landmark: z.string().max(250).optional().nullable(),
    isDefault: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (!isValidRegion(v.region)) ctx.addIssue({ code: 'custom', path: ['region'], message: "Viloyat noto'g'ri" });
    else if (!isValidDistrict(v.region, v.district)) ctx.addIssue({ code: 'custom', path: ['district'], message: "Tuman noto'g'ri" });
  });

r.get(
  '/me/addresses',
  ah(async (req, res) => {
    ok(res, await prisma.address.findMany({ where: { userId: req.user!.id, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] }));
  }),
);

r.post(
  '/me/addresses',
  validate({ body: addressSchema }),
  ah(async (req, res) => {
    const count = await prisma.address.count({ where: { userId: req.user!.id, deletedAt: null } });
    if (count >= 10) throw Errors.badRequest('Eng ko\'pi bilan 10 ta manzil saqlash mumkin');
    const isDefault = req.body.isDefault || count === 0;
    const a = await prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
      return tx.address.create({ data: { ...req.body, isDefault, userId: req.user!.id } });
    });
    created(res, a);
  }),
);

r.put(
  '/me/addresses/:id',
  validate({ body: addressSchema }),
  ah(async (req, res) => {
    const a = await prisma.address.findFirst({ where: { id: req.params.id, userId: req.user!.id, deletedAt: null } });
    if (!a) throw Errors.notFound('Manzil');
    const updated = await prisma.$transaction(async (tx) => {
      if (req.body.isDefault) await tx.address.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
      return tx.address.update({ where: { id: a.id }, data: req.body });
    });
    ok(res, updated);
  }),
);

r.delete(
  '/me/addresses/:id',
  ah(async (req, res) => {
    const x = await prisma.address.updateMany({
      where: { id: req.params.id, userId: req.user!.id, deletedAt: null },
      data: { deletedAt: new Date(), isDefault: false },
    });
    if (!x.count) throw Errors.notFound('Manzil');
    ok(res, { ok: true });
  }),
);

export default r;
