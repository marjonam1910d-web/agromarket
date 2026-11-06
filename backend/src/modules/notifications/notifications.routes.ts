import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, validate, q, pageParams, pageMeta } from '../../common/http';
import { authenticate } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

const r = Router();
r.use(authenticate);

const listQ = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  unread: z.enum(['true', 'false']).optional(),
});

r.get(
  '/',
  validate({ query: listQ }),
  ah(async (req, res) => {
    const query = q(req, listQ);
    const { skip, take, page, limit } = pageParams(query.page, query.limit);
    const where = { userId: req.user!.id, ...(query.unread === 'true' ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    ok(res, items, { ...pageMeta(total, page, limit), unread });
  }),
);

r.get(
  '/unread-count',
  ah(async (req, res) => {
    const [notifications, messages] = await Promise.all([
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
      prisma.message.count({
        where: {
          readAt: null,
          senderId: { not: req.user!.id },
          conversation: { OR: [{ buyerId: req.user!.id }, { sellerUserId: req.user!.id }] },
        },
      }),
    ]);
    ok(res, { notifications, messages });
  }),
);

r.patch(
  '/:id/read',
  ah(async (req, res) => {
    await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { readAt: new Date() } });
    ok(res, { ok: true });
  }),
);

r.post(
  '/read-all',
  ah(async (req, res) => {
    const x = await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    ok(res, { updated: x.count });
  }),
);

export default r;
