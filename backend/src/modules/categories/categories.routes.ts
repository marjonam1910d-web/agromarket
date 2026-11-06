import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { cache } from '../../lib/redis';
import { authenticate, requireRole } from '../../middleware/auth';
import { slugify } from '../../common/utils';
import { audit } from '../../common/audit';

const r = Router();

/** Ommaviy: faol kategoriyalar daraxti + faol mahsulotlar soni (60 s kesh) */
r.get(
  '/',
  ah(async (_req, res) => {
    const data = await cache.wrap('categories:tree', 60, async () => {
      const [cats, counts] = await Promise.all([
        prisma.category.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameUz: 'asc' }] }),
        prisma.product.groupBy({ by: ['categoryId'], where: { status: 'active', deletedAt: null }, _count: { _all: true } }),
      ]);
      const countMap = new Map(counts.map((c) => [c.categoryId, c._count._all]));
      const withCount = cats.map((c) => ({ ...c, productCount: countMap.get(c.id) ?? 0 }));
      return withCount
        .filter((c) => !c.parentId)
        .map((p) => {
          const children = withCount.filter((c) => c.parentId === p.id);
          return { ...p, productCount: p.productCount + children.reduce((a, c) => a + c.productCount, 0), children };
        });
    });
    ok(res, data);
  }),
);

const catSchema = z.object({
  nameUz: z.string().trim().min(2).max(60),
  nameRu: z.string().trim().min(2).max(60),
  nameEn: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  icon: z.string().max(40).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const admin = [authenticate, requireRole('ADMIN')];

r.get(
  '/all',
  ...admin,
  ah(async (_req, res) => ok(res, await prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }], include: { _count: { select: { products: true } } } }))),
);

r.post(
  '/',
  ...admin,
  validate({ body: catSchema }),
  ah(async (req, res) => {
    const c = await prisma.category.create({ data: { ...req.body, slug: req.body.slug || slugify(req.body.nameUz) } });
    await audit(req, 'category.create', 'Category', c.id, { name: c.nameUz });
    await cache.del('categories');
    created(res, c);
  }),
);

r.put(
  '/:id',
  ...admin,
  validate({ body: catSchema.partial() }),
  ah(async (req, res) => {
    if (req.body.parentId === req.params.id) throw Errors.badRequest("Kategoriya o'ziga ota bo'la olmaydi");
    const c = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
    await audit(req, 'category.update', 'Category', c.id, req.body);
    await cache.del('categories');
    ok(res, c);
  }),
);

r.delete(
  '/:id',
  ...admin,
  ah(async (req, res) => {
    const used = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (used > 0) {
      // Mahsulotlar bog'langan bo'lsa — o'chirmaymiz, faolsizlantiramiz (referential integrity)
      await prisma.category.update({ where: { id: req.params.id }, data: { isActive: false } });
      await audit(req, 'category.deactivate', 'Category', req.params.id);
      await cache.del('categories');
      return ok(res, { deactivated: true });
    }
    await prisma.category.delete({ where: { id: req.params.id } });
    await audit(req, 'category.delete', 'Category', req.params.id);
    await cache.del('categories');
    ok(res, { deleted: true });
  }),
);

export default r;
