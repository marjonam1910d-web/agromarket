import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { ah, ok, created, validate, q, pageMeta, pageParams } from '../../common/http';
import { AppError, Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { authenticate, requireRole } from '../../middleware/auth';
import { authLimiter } from '../../middleware/security';
import { audit } from '../../common/audit';
import { notify } from '../notifications/notifications.service';
import { walletBalance } from './wallet.service';

const r = Router();
r.use(authenticate);
const MIN_WITHDRAW = 10_000;

r.get(
  '/',
  validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }) }),
  ah(async (req, res) => {
    const f = q(req) as { page: number; limit: number };
    const { skip, take } = pageParams(f.page, f.limit);
    const [balance, rows, total] = await Promise.all([
      walletBalance(req.user!.id),
      prisma.walletTransaction.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.walletTransaction.count({ where: { userId: req.user!.id } }),
    ]);
    ok(res, { balance, transactions: rows, minWithdraw: MIN_WITHDRAW }, pageMeta(total, f.page, f.limit));
  }),
);

/** Saqlangan kartaga yechib olish */
r.post(
  '/withdraw',
  authLimiter(),
  validate({ body: z.object({ amount: z.number().int().min(MIN_WITHDRAW).max(500_000_000), cardId: z.string() }) }),
  ah(async (req, res) => {
    const uid = req.user!.id;
    const card = await prisma.paymentCard.findFirst({ where: { id: req.body.cardId, userId: uid } });
    if (!card) throw Errors.notFound('Karta');
    const tx = await prisma.$transaction(
      async (db) => {
        // bir vaqtda ikki so'rov balansni ikki marta sarflamasligi uchun foydalanuvchi qatorini qulflaymiz
        await db.$queryRaw`SELECT id FROM "User" WHERE id = ${uid} FOR UPDATE`;
        const bal = await walletBalance(uid, db);
        if (bal.available.lt(req.body.amount)) throw new AppError(400, 'INSUFFICIENT_FUNDS', "Hamyonda mablag' yetarli emas");
        const sandbox = card.provider === 'sandbox';
        const t = await db.walletTransaction.create({
          data: { userId: uid, kind: 'withdrawal', amount: new Prisma.Decimal(-req.body.amount), status: sandbox ? 'completed' : 'pending', cardMasked: card.maskedPan, note: sandbox ? "Sinov rejimi: avtomatik o'tkazildi" : null, completedAt: sandbox ? new Date() : null },
        });
        // refId — o'zining ID'si (unikal kalit uchun)
        return db.walletTransaction.update({ where: { id: t.id }, data: { refId: t.id, refType: 'Withdrawal' } });
      },
      { isolationLevel: 'Serializable' },
    );
    if (tx.status === 'completed') void notify({ userId: uid, type: 'wallet', key: 'wallet.withdrawn', params: { amount: req.body.amount, card: card.maskedPan.slice(-4) }, link: '/wallet' });
    await audit(req, 'wallet.withdraw', 'WalletTransaction', tx.id, { amount: req.body.amount });
    created(res, tx);
  }),
);

// ───────── Admin: yechib olish so'rovlari ─────────
r.get(
  '/admin/withdrawals',
  requireRole('ADMIN'),
  validate({ query: z.object({ status: z.enum(['pending', 'completed', 'failed']).default('pending') }) }),
  ah(async (req, res) => {
    const f = q(req) as { status: 'pending' };
    ok(res, await prisma.walletTransaction.findMany({ where: { kind: 'withdrawal', status: f.status }, orderBy: { createdAt: 'asc' }, take: 200, include: { user: { select: { id: true, fullName: true, phone: true, sellerProfile: { select: { farmName: true } } } } } }));
  }),
);

r.post(
  '/admin/withdrawals/:id/:action',
  requireRole('ADMIN'),
  validate({ body: z.object({ reason: z.string().max(300).optional() }) }),
  ah(async (req, res) => {
    const action = req.params.action;
    if (!['approve', 'reject'].includes(action)) throw Errors.notFound('Amal');
    const t = await prisma.walletTransaction.findFirst({ where: { id: req.params.id, kind: 'withdrawal' } });
    if (!t) throw Errors.notFound("So'rov");
    if (t.status !== 'pending') throw new AppError(409, 'ALREADY_PROCESSED', "So'rov allaqachon ko'rib chiqilgan");
    const upd = await prisma.walletTransaction.update({
      where: { id: t.id },
      data: action === 'approve' ? { status: 'completed', completedAt: new Date(), processedBy: req.user!.id } : { status: 'failed', note: req.body.reason ?? 'Rad etildi', processedBy: req.user!.id, completedAt: new Date() },
    });
    const amount = t.amount.neg().toFixed(0);
    void notify(
      action === 'approve'
        ? { userId: t.userId, type: 'wallet', key: 'wallet.withdrawn', params: { amount, card: (t.cardMasked ?? '').slice(-4) }, link: '/wallet' }
        : { userId: t.userId, type: 'wallet', key: 'wallet.rejected', params: { amount, reason: req.body.reason ?? '—' }, link: '/wallet' },
    );
    await audit(req, `wallet.withdraw_${action}`, 'WalletTransaction', t.id);
    ok(res, upd);
  }),
);

/** Platforma bo'yicha umumiy ko'rsatkichlar (admin) */
r.get(
  '/admin/summary',
  requireRole('ADMIN'),
  ah(async (_req, res) => {
    const [payouts, commission, withdrawn, pending] = await Promise.all([
      prisma.walletTransaction.aggregate({ where: { kind: 'order_payout', status: 'completed' }, _sum: { amount: true } }),
      prisma.sellerOrder.aggregate({ where: { status: 'delivered' }, _sum: { commissionAmount: true } }),
      prisma.walletTransaction.aggregate({ where: { kind: 'withdrawal', status: 'completed' }, _sum: { amount: true } }),
      prisma.walletTransaction.aggregate({ where: { kind: 'withdrawal', status: 'pending' }, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    ok(res, {
      payouts: payouts._sum.amount ?? 0,
      commission: commission._sum.commissionAmount ?? 0,
      withdrawn: (withdrawn._sum.amount ?? new Prisma.Decimal(0)).neg(),
      pendingAmount: (pending._sum.amount ?? new Prisma.Decimal(0)).neg(),
      pendingCount: pending._count._all,
      sandbox: env.sandboxAllowed,
    });
  }),
);

/**
 * Admin: qo'lda o'tkazma (tuzatish). Masalan, tashqi to'lovni hamyonga kiritish yoki demo uchun balans berish.
 * Musbat — hamyonga qo'shiladi, manfiy — yechiladi (mavjud balansdan oshmaydi). Har biri audit logga yoziladi.
 */
r.post(
  '/admin/adjust',
  authenticate,
  requireRole('ADMIN'),
  validate({ body: z.object({ userId: z.string(), amount: z.number().int().min(-100_000_000).max(100_000_000).refine((v) => v !== 0), note: z.string().trim().min(3).max(300) }) }),
  ah(async (req, res) => {
    const u = await prisma.user.findFirst({ where: { id: req.body.userId, role: 'SELLER', deletedAt: null }, select: { id: true } });
    if (!u) throw Errors.notFound('Fermer');
    const tx = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM "User" WHERE id = ${u.id} FOR UPDATE`;
      if (req.body.amount < 0) {
        const b = await walletBalance(u.id, db);
        if (new Prisma.Decimal(b.available).add(req.body.amount).lt(0)) throw new AppError(409, 'INSUFFICIENT_FUNDS', "Hamyonda mablag' yetarli emas");
      }
      return db.walletTransaction.create({ data: { userId: u.id, kind: 'adjustment', amount: new Prisma.Decimal(req.body.amount), refType: 'Admin', refId: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, note: req.body.note, completedAt: new Date(), processedBy: req.user!.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(req, 'wallet.adjust', 'WalletTransaction', tx.id, { userId: u.id, amount: req.body.amount });
    void notify({ userId: u.id, type: 'wallet', key: 'wallet.credited', params: { number: req.body.note.slice(0, 40), amount: String(req.body.amount) }, link: '/wallet' });
    created(res, tx);
  }),
);

export default r;
