import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { productCardSelect, toCard } from '../products/products.service';

const r = Router();
r.use(authenticate);

r.get(
  '/',
  ah(async (req, res) => {
    const now = new Date();
    const favs = await prisma.favorite.findMany({
      where: { userId: req.user!.id, product: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      select: { productId: true, createdAt: true, product: { select: productCardSelect(now) } },
    });
    ok(res, favs.map((f) => ({ ...toCard(f.product, now), favoritedAt: f.createdAt })));
  }),
);

r.get('/ids', ah(async (req, res) => ok(res, (await prisma.favorite.findMany({ where: { userId: req.user!.id }, select: { productId: true } })).map((f) => f.productId))));

r.post(
  '/',
  validate({ body: z.object({ productId: z.string() }) }),
  ah(async (req, res) => {
    const p = await prisma.product.findFirst({ where: { id: req.body.productId, deletedAt: null } });
    if (!p) throw Errors.notFound('Mahsulot');
    await prisma.favorite.upsert({
      where: { userId_productId: { userId: req.user!.id, productId: p.id } },
      create: { userId: req.user!.id, productId: p.id },
      update: {},
    });
    ok(res, { favorite: true });
  }),
);

r.delete(
  '/:productId',
  ah(async (req, res) => {
    await prisma.favorite.deleteMany({ where: { userId: req.user!.id, productId: req.params.productId } });
    ok(res, { favorite: false });
  }),
);

export default r;
