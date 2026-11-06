import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, validate, q } from '../../common/http';
import { Errors, AppError } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate } from '../../middleware/auth';
import { D } from '../../common/money';
import { buildQuote } from './cart.service';

const r = Router();
r.use(authenticate);

const quoteQ = z.object({ region: z.string().optional(), district: z.string().optional(), coupon: z.string().max(40).optional() });

r.get(
  '/',
  validate({ query: quoteQ }),
  ah(async (req, res) => {
    const f = q(req, quoteQ);
    ok(res, await buildQuote(prisma, req.user!.id, { region: f.region, district: f.district, couponCode: f.coupon }));
  }),
);

const qty = z.coerce.number().positive().max(1_000_000);

r.post(
  '/items',
  validate({ body: z.object({ productId: z.string().min(1), quantity: qty, mode: z.enum(['add', 'set']).default('add') }) }),
  ah(async (req, res) => {
    if (req.user!.role === 'ADMIN') throw Errors.forbidden('Admin xarid qila olmaydi');
    const p = await prisma.product.findFirst({
      where: { id: req.body.productId, deletedAt: null, status: 'active', seller: { verificationStatus: 'APPROVED' } },
      include: { inventory: true },
    });
    if (!p) throw Errors.notFound('Mahsulot');
    if (req.user!.sellerId && p.sellerId === req.user!.sellerId) throw Errors.badRequest("O'z mahsulotingizni sotib ololmaysiz");

    const cart = await prisma.cart.upsert({ where: { userId: req.user!.id }, create: { userId: req.user!.id }, update: {} });
    const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId: p.id } } });
    const next = req.body.mode === 'add' && existing ? existing.quantity.add(D(req.body.quantity)) : D(req.body.quantity);
    const stock = p.inventory?.quantity ?? D(0);
    if (next.greaterThan(stock)) throw new AppError(409, 'INSUFFICIENT_STOCK', `Omborda faqat ${stock.toString()} ${p.unit} mavjud`, { available: stock });
    if (next.lessThan(p.minOrderQty)) throw new AppError(400, 'BELOW_MIN_QTY', `Minimal buyurtma: ${p.minOrderQty.toString()} ${p.unit}`, { min: p.minOrderQty });

    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: p.id } },
      create: { cartId: cart.id, productId: p.id, quantity: next },
      update: { quantity: next },
    });
    ok(res, await buildQuote(prisma, req.user!.id));
  }),
);

r.patch(
  '/items/:id',
  validate({ body: z.object({ quantity: qty }) }),
  ah(async (req, res) => {
    const item = await prisma.cartItem.findFirst({ where: { id: req.params.id, cart: { userId: req.user!.id } }, include: { product: { include: { inventory: true } } } });
    if (!item) throw Errors.notFound('Savatcha elementi');
    const nq = D(req.body.quantity);
    const stock = item.product.inventory?.quantity ?? D(0);
    if (nq.greaterThan(stock)) throw new AppError(409, 'INSUFFICIENT_STOCK', `Omborda faqat ${stock.toString()} ${item.product.unit} mavjud`, { available: stock });
    if (nq.lessThan(item.product.minOrderQty)) throw new AppError(400, 'BELOW_MIN_QTY', `Minimal buyurtma: ${item.product.minOrderQty.toString()}`);
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: nq } });
    ok(res, await buildQuote(prisma, req.user!.id));
  }),
);

r.delete(
  '/items/:id',
  ah(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { id: req.params.id, cart: { userId: req.user!.id } } });
    ok(res, await buildQuote(prisma, req.user!.id));
  }),
);

r.delete(
  '/',
  ah(async (req, res) => {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: req.user!.id } } });
    await prisma.cart.updateMany({ where: { userId: req.user!.id }, data: { couponCode: null } });
    ok(res, await buildQuote(prisma, req.user!.id));
  }),
);

r.post(
  '/coupon',
  validate({ body: z.object({ code: z.string().trim().min(2).max(40).nullable() }) }),
  ah(async (req, res) => {
    const code = req.body.code ? req.body.code.toUpperCase() : null;
    if (code) {
      const quote = await buildQuote(prisma, req.user!.id, { couponCode: code });
      if (quote.couponError) throw new AppError(400, 'COUPON_INVALID', quote.couponError);
    }
    await prisma.cart.update({ where: { userId: req.user!.id }, data: { couponCode: code } });
    ok(res, await buildQuote(prisma, req.user!.id));
  }),
);

export default r;
