import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { authLimiter, otpLimiter } from '../../middleware/security';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { uniqueSlug } from '../../common/utils';
import { audit } from '../../common/audit';
import { notifyAdmins } from '../notifications/notifications.service';
import {
  destroySession,
  hashPassword,
  issueSession,
  login,
  parseIdentifier,
  publicUser,
  readOtpToken,
  requestOtp,
  revokeAllSessions,
  rotateSession,
  verifyOtp,
} from './auth.service';

export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 belgidan iborat bo'lsin")
  .max(128)
  .regex(/[A-Za-z]/, "Parolda kamida bitta harf bo'lsin")
  .regex(/\d/, "Parolda kamida bitta raqam bo'lsin");

const r = Router();

/** CSRF cookie'ni olish uchun (SPA ishga tushganda chaqiriladi) */
r.get('/csrf', (_req, res) => ok(res, { ok: true }));

r.post(
  '/otp/request',
  otpLimiter(),
  validate({ body: z.object({ target: z.string().min(5).max(120), purpose: z.enum(['REGISTER', 'RESET_PASSWORD']) }) }),
  ah(async (req, res) => ok(res, await requestOtp(req.body.target, req.body.purpose))),
);

r.post(
  '/otp/verify',
  authLimiter(),
  validate({
    body: z.object({
      target: z.string().min(5).max(120),
      purpose: z.enum(['REGISTER', 'RESET_PASSWORD']),
      code: z.string().regex(/^\d{6}$/, "Kod 6 xonali bo'lishi kerak"),
    }),
  }),
  ah(async (req, res) => ok(res, await verifyOtp(req.body.target, req.body.purpose, req.body.code))),
);

const registerSchema = z
  .object({
    otpToken: z.string().min(10),
    fullName: z.string().trim().min(3, 'Ism va familiyani kiriting').max(100),
    password: passwordSchema,
    role: z.enum(['BUYER', 'SELLER']),
    termsAccepted: z.literal(true, { errorMap: () => ({ message: 'Foydalanish shartlariga rozilik kerak' }) }),
    locale: z.enum(['uz', 'ru', 'en']).default('uz'),
    buyer: z.object({ isWholesale: z.boolean().default(false), companyName: z.string().max(120).optional() }).optional(),
    seller: z
      .object({
        farmName: z.string().trim().min(2).max(120),
        region: z.string(),
        district: z.string(),
        address: z.string().trim().min(3).max(250),
        tin: z
          .string()
          .regex(/^\d{9}$|^\d{14}$/, "STIR 9 xonali (yoki JShShIR 14 xonali) bo'lishi kerak")
          .optional()
          .or(z.literal('')),
      })
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'SELLER') {
      if (!v.seller) ctx.addIssue({ code: 'custom', path: ['seller'], message: "Xo'jalik ma'lumotlari kerak" });
      else {
        if (!isValidRegion(v.seller.region)) ctx.addIssue({ code: 'custom', path: ['seller', 'region'], message: "Viloyat noto'g'ri" });
        else if (!isValidDistrict(v.seller.region, v.seller.district))
          ctx.addIssue({ code: 'custom', path: ['seller', 'district'], message: "Tuman noto'g'ri" });
      }
    }
  });

r.post(
  '/register',
  authLimiter(),
  validate({ body: registerSchema }),
  ah(async (req, res) => {
    const b = req.body as z.infer<typeof registerSchema>;
    const target = readOtpToken(b.otpToken, 'REGISTER');
    const { kind } = parseIdentifier(target);
    const passwordHash = await hashPassword(b.password);
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      const exists = await tx.user.findFirst({ where: kind === 'phone' ? { phone: target } : { email: target } });
      if (exists) throw Errors.conflict('ALREADY_REGISTERED', "Bu raqam/email bilan allaqachon ro'yxatdan o'tilgan");
      // Admin roli API orqali hech qachon berilmaydi — faqat BUYER yoki SELLER
      const u = await tx.user.create({
        data: {
          fullName: b.fullName,
          passwordHash,
          role: b.role,
          locale: b.locale,
          termsAcceptedAt: now,
          ...(kind === 'phone' ? { phone: target, phoneVerifiedAt: now } : { email: target, emailVerifiedAt: now }),
        },
      });
      await tx.cart.create({ data: { userId: u.id } });
      if (b.role === 'BUYER') {
        await tx.buyerProfile.create({
          data: { userId: u.id, isWholesale: b.buyer?.isWholesale ?? false, companyName: b.buyer?.companyName },
        });
      } else if (b.seller) {
        await tx.sellerProfile.create({
          data: {
            userId: u.id,
            farmName: b.seller.farmName,
            slug: uniqueSlug(b.seller.farmName),
            region: b.seller.region,
            district: b.seller.district,
            address: b.seller.address,
            tin: b.seller.tin || null,
          },
        });
      }
      await tx.auditLog.create({ data: { actorId: u.id, action: 'user.register', entityType: 'User', entityId: u.id, ip: req.ip } });
      return u;
    });

    if (b.role === 'SELLER') {
      await notifyAdmins({ type: 'seller.verification', key: 'seller.registered', params: { farm: b.seller!.farmName }, link: '/admin/sellers' });
    }
    const tokens = await issueSession(req, res, user, true);
    created(res, { user: await publicUser(user.id), ...(req.get('x-client') === 'mobile' ? tokens : {}) });
  }),
);

r.post(
  '/login',
  authLimiter(),
  validate({ body: z.object({ login: z.string().min(3).max(120), password: z.string().min(1).max(128), remember: z.boolean().default(false) }) }),
  ah(async (req, res) => {
    const user = await login(req.body.login, req.body.password);
    const tokens = await issueSession(req, res, user, req.body.remember);
    ok(res, { user: await publicUser(user.id), ...(req.get('x-client') === 'mobile' ? tokens : {}) });
  }),
);

r.post(
  '/refresh',
  ah(async (req, res) => {
    const tokens = await rotateSession(req, res);
    ok(res, req.get('x-client') === 'mobile' ? tokens : { ok: true });
  }),
);

r.post(
  '/logout',
  ah(async (req, res) => {
    await destroySession(req, res);
    ok(res, { ok: true });
  }),
);

r.post(
  '/logout-all',
  authenticate,
  ah(async (req, res) => {
    await revokeAllSessions(req.user!.id);
    await destroySession(req, res);
    ok(res, { ok: true });
  }),
);

r.post(
  '/password/reset',
  authLimiter(),
  validate({ body: z.object({ otpToken: z.string(), password: passwordSchema }) }),
  ah(async (req, res) => {
    const target = readOtpToken(req.body.otpToken, 'RESET_PASSWORD');
    const { kind } = parseIdentifier(target);
    const user = await prisma.user.findFirst({ where: kind === 'phone' ? { phone: target } : { email: target } });
    if (!user) throw Errors.notFound('Foydalanuvchi');
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(req.body.password), failedLoginCount: 0, lockedUntil: null },
    });
    await revokeAllSessions(user.id);
    await audit(req, 'user.password_reset', 'User', user.id);
    ok(res, { ok: true });
  }),
);

r.get(
  '/me',
  authenticate,
  ah(async (req, res) => ok(res, await publicUser(req.user!.id))),
);

export default r;
