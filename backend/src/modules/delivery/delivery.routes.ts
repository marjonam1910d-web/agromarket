import { Router } from 'express';
import { z } from 'zod';
import { ah, ok, created, validate } from '../../common/http';
import { Errors } from '../../common/errors';
import { prisma } from '../../lib/prisma';
import { authenticate, requireSeller, sellerId } from '../../middleware/auth';
import { isValidDistrict, isValidRegion } from '../../common/regions';
import { D } from '../../common/money';
import { getSetting } from '../../common/audit';
import { calcFee, findZone } from './delivery.service';

const r = Router();

/** Ommaviy: yetkazish vaqt oraliqlari */
r.get('/slots', ah(async (_req, res) => ok(res, { slots: await getSetting('delivery.slots'), maxDaysAhead: await getSetting('delivery.maxDaysAhead') })));

/** Ommaviy: sotuvchi qaysi hududlarga yetkazadi */
r.get(
  '/zones/seller/:sellerId',
  ah(async (req, res) => {
    ok(res, await prisma.deliveryZone.findMany({ where: { sellerId: req.params.sellerId, isActive: true }, orderBy: [{ region: 'asc' }, { district: 'asc' }] }));
  }),
);

/** Ommaviy: mahsulot sahifasida "menga yetkazadimi va qancha?" */
r.get(
  '/estimate',
  validate({ query: z.object({ sellerId: z.string(), region: z.string(), district: z.string(), amount: z.coerce.number().min(0).default(0), weightKg: z.coerce.number().min(0).default(1) }) }),
  ah(async (req, res) => {
    const f = (req as unknown as { q: { sellerId: string; region: string; district: string; amount: number; weightKg: number } }).q;
    const zone = await findZone(prisma, f.sellerId, f.region, f.district);
    if (!zone) return ok(res, { deliverable: false });
    ok(res, { deliverable: true, fee: calcFee(zone, D(f.amount), D(f.weightKg)), minDays: zone.minDays, maxDays: zone.maxDays, freeFromAmount: zone.freeFromAmount });
  }),
);

// ───────── Sotuvchi yetkazish zonalari ─────────
const zoneSchema = z
  .object({
    region: z.string(),
    district: z.string().nullable().optional(),
    baseFee: z.coerce.number().min(0).max(10_000_000),
    perKgFee: z.coerce.number().min(0).max(1_000_000).default(0),
    freeFromAmount: z.coerce.number().min(0).nullable().optional(),
    minDays: z.coerce.number().int().min(0).max(30).default(1),
    maxDays: z.coerce.number().int().min(0).max(60).default(3),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (!isValidRegion(v.region)) ctx.addIssue({ code: 'custom', path: ['region'], message: "Viloyat noto'g'ri" });
    else if (v.district && !isValidDistrict(v.region, v.district)) ctx.addIssue({ code: 'custom', path: ['district'], message: "Tuman noto'g'ri" });
    if (v.maxDays < v.minDays) ctx.addIssue({ code: 'custom', path: ['maxDays'], message: "Maksimal kun minimaldan kichik bo'lmasin" });
  });

const toData = (b: z.infer<typeof zoneSchema>) => ({
  region: b.region,
  district: b.district || null,
  baseFee: D(b.baseFee),
  perKgFee: D(b.perKgFee),
  freeFromAmount: b.freeFromAmount ? D(b.freeFromAmount) : null,
  minDays: b.minDays,
  maxDays: b.maxDays,
  isActive: b.isActive,
});

r.get('/zones', authenticate, requireSeller, ah(async (req, res) => ok(res, await prisma.deliveryZone.findMany({ where: { sellerId: sellerId(req) }, orderBy: [{ region: 'asc' }, { district: 'asc' }] }))));

r.post(
  '/zones',
  authenticate,
  requireSeller,
  validate({ body: zoneSchema }),
  ah(async (req, res) => {
    const sid = sellerId(req);
    const dup = await prisma.deliveryZone.findFirst({ where: { sellerId: sid, region: req.body.region, district: req.body.district || null } });
    if (dup) throw Errors.conflict('ZONE_EXISTS', 'Bu hudud uchun tarif allaqachon mavjud');
    created(res, await prisma.deliveryZone.create({ data: { sellerId: sid, ...toData(req.body) } }));
  }),
);

r.put(
  '/zones/:id',
  authenticate,
  requireSeller,
  validate({ body: zoneSchema }),
  ah(async (req, res) => {
    const z0 = await prisma.deliveryZone.findFirst({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!z0) throw Errors.notFound('Zona');
    ok(res, await prisma.deliveryZone.update({ where: { id: z0.id }, data: toData(req.body) }));
  }),
);

r.delete(
  '/zones/:id',
  authenticate,
  requireSeller,
  ah(async (req, res) => {
    const x = await prisma.deliveryZone.deleteMany({ where: { id: req.params.id, sellerId: sellerId(req) } });
    if (!x.count) throw Errors.notFound('Zona');
    ok(res, { deleted: true });
  }),
);

export default r;
