import { Router } from 'express';
import { ah, ok } from '../../common/http';
import { REGIONS } from '../../common/regions';
import { getSetting } from '../../common/audit';
import { env } from '../../config/env';

const r = Router();

/** Viloyat/tuman ma'lumotnomasi (frontend va mobil ilova uchun yagona manba) */
r.get('/regions', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  ok(res, REGIONS);
});

/** Ommaviy konfiguratsiya: qaysi to'lov usullari ishlaydi, sandbox rejimi, yetkazish oraliqlari */
r.get(
  '/config',
  ah(async (_req, res) => {
    const online = (enabled: boolean) => enabled || env.sandboxAllowed;
    ok(res, {
      paymentMethods: {
        cash: true,
        payme: online(env.paymeEnabled),
        click: online(env.clickEnabled),
        card: online(env.CARD_PROVIDER === 'payme' ? env.paymeEnabled : env.clickEnabled),
      },
      paymentSandbox: env.sandboxAllowed && !(env.paymeEnabled && env.clickEnabled),
      otpDevEcho: env.otpDevEcho,
      deliverySlots: await getSetting('delivery.slots'),
      maxDaysAhead: await getSetting('delivery.maxDaysAhead'),
      supportPhone: await getSetting('platform.supportPhone'),
      currency: 'UZS',
      timezone: 'Asia/Tashkent',
      locales: ['uz', 'ru', 'en'],
    });
  }),
);

export default r;
