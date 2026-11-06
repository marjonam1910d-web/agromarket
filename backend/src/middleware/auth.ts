import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { Errors } from '../common/errors';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  role: Role;
  sellerId?: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      viaBearer?: boolean;
    }
  }
}

export const ACCESS_COOKIE = 'am_access';
export const REFRESH_COOKIE = 'am_refresh';

interface AccessPayload {
  sub: string;
  role: Role;
  sid?: string | null;
}

export function signAccessToken(user: AuthUser) {
  const payload: AccessPayload = { sub: user.id, role: user.role, sid: user.sellerId ?? null };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m', issuer: 'agromarket' });
}

export function verifyAccessToken(token: string): AuthUser | null {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'agromarket' }) as AccessPayload;
    return { id: p.sub, role: p.role, sellerId: p.sid };
  } catch {
    return null;
  }
}

function extractToken(req: Request): { token: string | null; bearer: boolean } {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return { token: h.slice(7), bearer: true };
  return { token: (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? null, bearer: false };
}

/**
 * Tokenni tekshiradi va foydalanuvchi bloklanmaganini DB'dan tasdiqlaydi
 * (bloklangan foydalanuvchi access token muddati tugashini kutmasdan to'xtatiladi).
 */
async function resolveUser(req: Request): Promise<AuthUser | null> {
  const { token, bearer } = extractToken(req);
  if (!token) return null;
  const u = verifyAccessToken(token);
  if (!u) return null;
  const db = await prisma.user.findUnique({
    where: { id: u.id },
    select: { id: true, role: true, status: true, deletedAt: true, sellerProfile: { select: { id: true } } },
  });
  if (!db || db.status !== 'ACTIVE' || db.deletedAt) return null;
  req.viaBearer = bearer;
  return { id: db.id, role: db.role, sellerId: db.sellerProfile?.id ?? null };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const u = await resolveUser(req);
    if (!u) return next(Errors.unauthorized());
    req.user = u;
    next();
  } catch (e) {
    next(e);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const u = await resolveUser(req);
    if (u) req.user = u;
    next();
  } catch (e) {
    next(e);
  }
}

/** Rol tekshiruvi — har doim authenticate'dan keyin */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Errors.unauthorized());
    if (!roles.includes(req.user.role)) return next(Errors.forbidden());
    next();
  };
}

/** Sotuvchi profili mavjudligini talab qiladi va req.user.sellerId ni kafolatlaydi */
export function requireSeller(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Errors.unauthorized());
  if (req.user.role !== 'SELLER' || !req.user.sellerId) return next(Errors.forbidden('Faqat sotuvchilar uchun'));
  next();
}

export function sellerId(req: Request): string {
  if (!req.user?.sellerId) throw Errors.forbidden('Faqat sotuvchilar uchun');
  return req.user.sellerId;
}
