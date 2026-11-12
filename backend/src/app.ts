import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { getRedis } from './lib/redis';
import { ok } from './common/http';
import { csrf, globalLimiter } from './middleware/security';
import { errorHandler, notFound } from './middleware/error';
import { buildOpenApi } from './docs/openapi';
import { providerStatus } from './modules/payments/providers';
import { channelStatus } from './modules/notifications/channels';

import { CORE_MODULES, MODULES } from './modules/registry';
import { storage } from './lib/storage';
import fs from 'node:fs';

// Frontend'ni backend o'zi berganda qo'llanadigan xavfsizlik sarlavhalari (frontend/nginx.conf bilan bir xil)
const FRONTEND_CSP =
  "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' wss: ws: https://checkout.paycom.uz https://checkout.test.paycom.uz; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; " +
  "form-action 'self' https://checkout.paycom.uz https://test.paycom.uz https://my.click.uz";

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Proksi (Nginx / Render) ortida haqiqiy IP. TRUST_PROXY bilan hop sonini o'zgartirish mumkin
  app.set('trust proxy', env.TRUST_PROXY ?? (env.isProd ? 1 : false));

  app.use(
    helmet({
      contentSecurityPolicy: false, // API JSON qaytaradi; CSP frontend (Nginx) tomonidan beriladi
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // rasmlar frontend domenida ko'rinishi uchun
    }),
  );
  app.use(cors({ origin: env.APP_URL.split(','), credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Ommaviy rasmlar. Xususiy hujjatlar bu yerdan berilmaydi.
  if (env.STORAGE_DRIVER === 'db') {
    app.get('/uploads/public/*', async (req, res, next) => {
      try {
        const key = decodeURIComponent(req.path.replace(/^\/uploads\//, ''));
        const o = await storage.getPublicFromDb(key);
        if (!o) return res.status(404).end();
        res.setHeader('Content-Type', o.contentType);
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (o.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
        res.end(Buffer.from(o.data));
      } catch (e) {
        next(e);
      }
    });
  }
  app.use(
    '/uploads/public',
    express.static(path.resolve(env.UPLOAD_DIR, 'public'), { maxAge: '30d', immutable: true }),
  );

  const spec = buildOpenApi();
  app.get('/api/docs.json', (_req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'AgroMarket API' }));

  const api = express.Router();
  api.use(globalLimiter());
  api.use(csrf);

  api.get('/health', async (_req, res) => {
    const started = Date.now();
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    const r = getRedis();
    const redis = r ? await r.ping().then(() => 'ok').catch(() => 'down') : 'not-configured (in-memory)';
    res.status(db === 'ok' ? 200 : 503);
    ok(res, { status: db === 'ok' ? 'ok' : 'degraded', db, redis, latencyMs: Date.now() - started, payments: providerStatus(), channels: channelStatus(), version: '1.0.0' });
  });

  // /checkout — spetsifikatsiyadagi alohida guruh (orders modulidagi checkout'ga yo'naltiriladi)
  const ordersRouter = MODULES.find((m) => m.name === 'orders')?.mounts[0].router;
  if (ordersRouter) {
    api.use('/checkout', (req, res, next) => {
      req.url = `/checkout${req.url === '/' ? '' : req.url}`;
      ordersRouter(req, res, next);
    });
  }

  const disabled = new Set((process.env.MODULES_DISABLED ?? '').split(',').map((s) => s.trim()).filter((s) => s && !CORE_MODULES.includes(s)));
  for (const m of MODULES) {
    if (disabled.has(m.name)) continue;
    for (const mount of m.mounts) api.use(mount.path, mount.router);
  }

  app.use('/api/v1', api);

  // Bitta servisli deployment: tayyor frontend (SPA) ni ham shu server beradi
  const feDir = env.FRONTEND_DIR ? path.resolve(env.FRONTEND_DIR) : '';
  if (feDir && fs.existsSync(path.join(feDir, 'index.html'))) {
    const secure = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.setHeader('Content-Security-Policy', FRONTEND_CSP);
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(self), geolocation=()');
      next();
    };
    app.use(
      secure,
      express.static(feDir, {
        index: false,
        setHeaders: (res, file) => {
          res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      }),
    );
    const indexHtml = path.join(feDir, 'index.html');
    app.get(/^\/(?!api\/|api$|uploads\/|ws$).*/, secure, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
