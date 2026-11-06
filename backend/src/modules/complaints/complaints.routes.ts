import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { notifyAdmins } from '../notifications/notifications.service';

const r = Router();
r.use(authenticate);

r.get(
  '/mine',
  ah(async (req, res) => {
    ok(res, await prisma.complaint.findMany({ where: { reporterId: req.user!.id }, orderBy: { createdAt: 'desc' }, include: { order: { select: { orderNumber: true } } } }));
  }),
);

r.post(
  '/',
  validate({
    body: z.object({
      subject: z.string().trim().min(3).max(150),
      description: z.string().trim().min(10).max(3000),
      orderId: z.string().nullable().optional(),
      productId: z.string().nullable().optional(),
    }),
  }),
  ah(async (req, res) => {
    let againstId: string | null = null;
    if (req.body.orderId) {
      const o = await prisma.order.findFirst({ where: { id: req.body.orderId, buyerId: req.user!.id }, include: { sellerOrders: { include: { seller: { select: { userId: true } } } } } });
      if (!o) throw Errors.notFound('Buyurtma');
      if (o.sellerOrders.length === 1) againstId = o.sellerOrders[0].seller.userId;
    }
    if (req.body.productId) {
      const p = await prisma.product.findUnique({ where: { id: req.body.productId }, include: { seller: { select: { userId: true } } } });
      if (!p) throw Errors.notFound('Mahsulot');
      againstId ??= p.seller.userId;
    }
    const c = await prisma.complaint.create({ data: { ...req.body, reporterId: req.user!.id, againstId } });
    await notifyAdmins({ type: 'complaint.update', key: 'complaint.new', params: { subject: c.subject }, link: '/admin/complaints' });
    created(res, c);
  }),
);

export default r;
