import type { Payment, PaymentMethod, PaymentProvider } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../common/errors';

/**
 * Provayderdan mustaqil to'lov arxitekturasi.
 *  - payme  : Payme Merchant API (JSON-RPC webhook)       — PAYME_MERCHANT_ID + PAYME_KEY kerak
 *  - click  : Click SHOP API (Prepare/Complete webhook)    — CLICK_SERVICE_ID + CLICK_MERCHANT_ID + CLICK_SECRET_KEY kerak
 *  - card   : Uzcard/Humo — CARD_PROVIDER (payme|click) orqali qabul qilinadi
 *  - sandbox: kalitlar yo'q bo'lsa development/test uchun. Productionda O'CHIRILGAN.
 */
export function resolveProvider(method: PaymentMethod): PaymentProvider {
  if (method === 'cash') return 'cash';
  const wanted = method === 'card' ? env.CARD_PROVIDER : method;
  if (wanted === 'payme' && env.paymeEnabled) return 'payme';
  if (wanted === 'click' && env.clickEnabled) return 'click';
  if (env.sandboxAllowed) return 'sandbox';
  throw new AppError(503, 'PAYMENT_UNAVAILABLE', "Bu to'lov usuli hozircha mavjud emas. Naqd to'lovni tanlang.");
}

export function returnUrl(paymentId: string) {
  return `${env.APP_URL}/checkout/result?payment=${paymentId}`;
}

/** So'm → tiyin (Payme summalarni tiyinda yuboradi) */
export const toTiyin = (p: Pick<Payment, 'amount'>) => p.amount.mul(100).toFixed(0);

export function checkoutUrl(payment: Pick<Payment, 'id' | 'provider' | 'amount'>): string | null {
  switch (payment.provider) {
    case 'payme': {
      const base = env.PAYME_TEST_MODE ? 'https://test.paycom.uz' : 'https://checkout.paycom.uz';
      const params = `m=${env.PAYME_MERCHANT_ID};ac.order_id=${payment.id};a=${toTiyin(payment)};c=${returnUrl(payment.id)}`;
      return `${base}/${Buffer.from(params).toString('base64')}`;
    }
    case 'click': {
      const u = new URL('https://my.click.uz/services/pay');
      u.searchParams.set('service_id', env.CLICK_SERVICE_ID);
      u.searchParams.set('merchant_id', env.CLICK_MERCHANT_ID);
      if (env.CLICK_MERCHANT_USER_ID) u.searchParams.set('merchant_user_id', env.CLICK_MERCHANT_USER_ID);
      u.searchParams.set('amount', payment.amount.toFixed(2));
      u.searchParams.set('transaction_param', payment.id);
      u.searchParams.set('return_url', returnUrl(payment.id));
      return u.toString();
    }
    case 'sandbox':
      return `${env.APP_URL}/pay/sandbox/${payment.id}`;
    default:
      return null;
  }
}

export function providerStatus() {
  return {
    // Holat kodlari — matnni frontend foydalanuvchi tilida ko'rsatadi
    payme: env.paymeEnabled ? (env.PAYME_TEST_MODE ? 'test' : 'live') : 'off',
    click: env.clickEnabled ? 'live' : 'off',
    uzum: 'off',
    card: env.CARD_PROVIDER as string,
    sandbox: env.sandboxAllowed ? 'on' : 'off',
  };
}
