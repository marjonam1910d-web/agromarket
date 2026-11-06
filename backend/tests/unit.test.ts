import { describe, expect, it } from 'vitest';
import { allocate, D } from '../src/common/money';
import { finalUnitPrice, effectivePrice } from '../src/modules/products/pricing';
import { allowedTransitions } from '../src/modules/orders/lifecycle';
import { normalizePhone, slugify } from '../src/common/utils';
import { render } from '../src/modules/notifications/templates';
import { clickSign } from '../src/modules/payments/click';

describe('money', () => {
  it('allocates discount proportionally without losing a single som', () => {
    const parts = allocate(D(10001), [D(100), D(200), D(300)]);
    expect(parts.reduce((a, b) => a.add(b), D(0)).toString()).toBe('10001');
    expect(parts[0].toString()).toBe('1667');
  });
  it('never uses float arithmetic for money', () => {
    expect(D('0.1').add(D('0.2')).toString()).toBe('0.3');
  });
});

describe('pricing', () => {
  const now = new Date();
  const promo = (p: number) => [{ discountPercent: p, startsAt: new Date(now.getTime() - 1000), endsAt: new Date(now.getTime() + 100000), isActive: true }];
  it('takes discount price when lower', () => {
    expect(finalUnitPrice({ price: D(10000), discountPrice: D(8000) }, now).toString()).toBe('8000');
  });
  it('applies best of discount and active promotion', () => {
    expect(finalUnitPrice({ price: D(10000), discountPrice: D(9500), promotions: promo(20) }, now).toString()).toBe('8000');
  });
  it('ignores expired promotions', () => {
    const old = [{ discountPercent: 50, startsAt: new Date(0), endsAt: new Date(1000), isActive: true }];
    expect(finalUnitPrice({ price: D(10000), discountPrice: null, promotions: old }, now).toString()).toBe('10000');
  });
  it('effectivePrice ignores invalid discount', () => {
    expect(effectivePrice(100, 150).toString()).toBe('100');
  });
});

describe('order state machine', () => {
  it('seller cannot jump from pending to shipped', () => {
    expect(allowedTransitions('SELLER', 'pending')).not.toContain('shipped');
  });
  it('buyer can cancel only early', () => {
    expect(allowedTransitions('BUYER', 'pending')).toContain('cancelled');
    expect(allowedTransitions('BUYER', 'preparing')).not.toContain('cancelled');
  });
  it('delivered is terminal for seller', () => {
    expect(allowedTransitions('SELLER', 'delivered')).toEqual([]);
  });
});

describe('utils', () => {
  it('normalizes Uzbek phone numbers', () => {
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('+998901234567');
    expect(normalizePhone('12345')).toBeNull();
  });
  it('slugifies Uzbek and Cyrillic text', () => {
    expect(slugify("Bog'iston xo'jaligi")).toBe('bogiston-xojaligi');
    expect(slugify('Помидор свежий')).toBe('pomidor-svejiy');
  });
  it('renders notifications in 3 languages', () => {
    expect(render('order.status', 'ru', { number: 'AM1', status: 'shipped' }).body).toBe('AM1: В пути');
    expect(render('order.status', 'en', { number: 'AM1', status: 'shipped' }).body).toBe('AM1: Shipped');
    expect(render('order.status', 'uz', { number: 'AM1', status: 'shipped' }).body).toBe("AM1: Yo'lda");
  });
  it('builds Click signature deterministically', () => {
    const s = clickSign({ click_trans_id: '1', service_id: '111', merchant_trans_id: 'x', amount: '1000', action: '0', sign_time: 't' }, false);
    expect(s).toMatch(/^[a-f0-9]{32}$/);
  });
});
