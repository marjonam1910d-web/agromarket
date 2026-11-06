import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { Errors } from './errors';

/** Async route xatolarini error middleware'ga uzatadi */
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Yagona javob formati: { success, data, meta } */
export function ok(res: Response, data: unknown, meta?: Record<string, unknown>, status = 200) {
  return res.status(status).json({ success: true, data: serialize(data), ...(meta ? { meta } : {}) });
}

export function created(res: Response, data: unknown) {
  return ok(res, data, undefined, 201);
}

/** Prisma Decimal / BigInt qiymatlarini JSON uchun xavfsiz shaklga keltiradi */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === 'bigint') return Number(v);
      return v;
    }),
  );
}

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/** Zod bilan server tomonda validatsiya */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) (req as Request & { q: unknown }).q = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(Errors.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      } else next(err);
    }
  };
}

export function q<T extends ZodTypeAny>(req: Request, _schema?: T): z.infer<T> {
  return (req as Request & { q: z.infer<T> }).q;
}

export function pageParams(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(100, Math.max(1, limit ?? 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}

export function pageMeta(total: number, page: number, limit: number) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}
