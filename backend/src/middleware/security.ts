import type { NextFunction, Request, Response } from 'express';
import rateLimit, { type Store, type Options, type ClientRateLimitInfo } from 'express-rate-limit';
import crypto from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import { getRedis } from '../lib/redis';
import { safeEqual } from '../common/utils';

export const CSRF_COOKIE = 'am_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Webhooklar tashqi provayderlardan keladi — CSRF tekshiruvi ularga taalluqli emas (imzo tekshiriladi) */
const CSRF_EXEMPT = [/^\/api\/v1\/payments\/(payme|click)(\/|$)/, /^\/api\/v1\/health/];

/**
 * Double-submit cookie CSRF himoyasi.
 * Cookie (o'qiladigan, SameSite=Lax) + bir xil qiymatli X-CSRF-Token sarlavhasi talab qilinadi.
 * Bearer token bilan kelgan so'rovlar (mobil ilova) cookie ishlatmagani uchun CSRF'ga moyil emas.
 */
export function csrf(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
  if (!token) {
    token = crypto.randomBytes(24).toString('base64url');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN || undefined,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
  }
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();
  if (CSRF_EXEMPT.some((r) => r.test(req.originalUrl.split('?')[0]))) return next();
  const header = req.get(CSRF_HEADER);
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  if (!header || !cookie || !safeEqual(header, cookie)) {
    return next(new AppError(403, 'CSRF_INVALID', "Xavfsizlik tokeni yaroqsiz. Sahifani yangilang."));
  }
  next();
}

/** Redis bo'lsa — taqsimlangan rate limit; bo'lmasa express-rate-limit'ning xotira store'i */
class RedisStore implements Store {
  prefix: string;
  windowMs = 60000;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const r = getRedis()!;
    const k = `rl:${this.prefix}:${key}`;
    const totalHits = await r.incr(k);
    if (totalHits === 1) await r.pexpire(k, this.windowMs);
    const ttl = await r.pttl(k);
    return { totalHits, resetTime: new Date(Date.now() + Math.max(ttl, 0)) };
  }
  async decrement(key: string) {
    await getRedis()!.decr(`rl:${this.prefix}:${key}`);
  }
  async resetKey(key: string) {
    await getRedis()!.del(`rl:${this.prefix}:${key}`);
  }
}

function limiter(prefix: string, windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: getRedis() ? new RedisStore(prefix) : undefined,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: { code: 'TOO_MANY_REQUESTS', message: "Juda ko'p so'rov. Birozdan keyin urinib ko'ring." },
      }),
  });
}

export const globalLimiter = () => limiter('global', 60_000, Number(process.env.RATE_LIMIT_PER_MIN ?? 600));
export const authLimiter = () => limiter('auth', 15 * 60_000, 30);
export const otpLimiter = () => limiter('otp', 60 * 60_000, 10);
