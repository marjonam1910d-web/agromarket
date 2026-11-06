import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, translate } from '@/i18n';
import uz from '@/i18n/uz';
import ru from '@/i18n/ru';
import en from '@/i18n/en';
import { Button, Pagination, Stars } from '@/components/ui';
import { money, normalizePhone, phone } from '@/utils/format';

function keys(o: object, p = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
}

describe('i18n', () => {
  it('has identical key sets in uz/ru/en', () => {
    expect(keys(ru).sort()).toEqual(keys(uz).sort());
    expect(keys(en).sort()).toEqual(keys(uz).sort());
  });
  it('interpolates params', () => {
    expect(translate('en', 'catalog.results', { n: 5 })).toBe('5 products');
    expect(translate('ru', 'catalog.results', { n: 5 })).toBe('5 товаров');
  });
});

describe('format', () => {
  it('formats UZS without decimals', () => {
    expect(money(12000, 'uz')).toBe("12 000 so'm");
    expect(money('1500000.4', 'en')).toBe('1 500 000 UZS');
  });
  it('normalizes and prints phones', () => {
    expect(normalizePhone('90 123 45 67')).toBe('+998901234567');
    expect(phone('+998901234567')).toBe('+998 90 123 45 67');
  });
});

describe('ui', () => {
  it('Button shows loading state and is disabled', () => {
    render(<Button loading>Saqlash</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('Stars has accessible label', () => {
    render(<Stars value={4.5} />);
    expect(screen.getByLabelText('4.5 / 5')).toBeInTheDocument();
  });
  it('Pagination calls onChange', () => {
    let p = 1;
    render(<I18nProvider><Pagination page={1} pages={3} onChange={(n) => (p = n)} /></I18nProvider>);
    fireEvent.click(screen.getByText('2'));
    expect(p).toBe(2);
  });
});
