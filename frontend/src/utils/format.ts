import type { Lang } from '@/i18n';

const LOCALE: Record<Lang, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' };
const CURRENCY: Record<Lang, string> = { uz: "so'm", ru: 'сум', en: 'UZS' };
const TZ = 'Asia/Tashkent';

export type Money = string | number | null | undefined;

/** Pul — har doim butun so'm, minglik ajratgich bo'sh joy */
export function money(v: Money, lang: Lang = 'uz', withCurrency = true) {
  const n = Number(v ?? 0);
  const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)).replace(/ /g, ' ');
  return withCurrency ? `${s} ${CURRENCY[lang]}` : s;
}

export function num(v: Money, digits = 2) {
  const n = Number(v ?? 0);
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n).replace(/ /g, ' ');
}

const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_MONTHS_LONG = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_DAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const UZ_DAYS_LONG = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

/**
 * O'zbek tili uchun brauzerlarning ICU ma'lumoti to'liq emas ("M11" kabi chiqadi),
 * shuning uchun oy/hafta kuni nomlari o'zimizda. ru/en — standart Intl.
 */
export function date(v: string | Date | null | undefined, lang: Lang = 'uz', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!v) return '—';
  const d = new Date(v);
  if (lang !== 'uz') return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: TZ, ...opts }).format(d);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  const m = Number(parts.month) - 1;
  const out: string[] = [];
  if (opts.weekday) out.push(`${opts.weekday === 'long' ? UZ_DAYS_LONG[wd] : UZ_DAYS_SHORT[wd]},`);
  if (opts.day) out.push(String(Number(parts.day)));
  if (opts.month) out.push(opts.month === 'long' ? UZ_MONTHS_LONG[m] : UZ_MONTHS_SHORT[m]);
  if (opts.year) out.push(parts.year);
  if (opts.hour) out.push(`${parts.hour}:${parts.minute}`);
  return out.join(' ');
}

export function dateTime(v: string | Date | null | undefined, lang: Lang = 'uz') {
  return date(v, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function relative(v: string | Date, lang: Lang = 'uz') {
  const diff = (new Date(v).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return date(v, lang);
}

/** +998901234567 → +998 90 123 45 67 */
export function phone(p?: string | null) {
  if (!p) return '—';
  const m = p.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}

export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 9) d = `998${d}`;
  return d.length === 12 && d.startsWith('998') ? `+${d}` : null;
}

export function catName(c: { nameUz: string; nameRu: string; nameEn: string } | null | undefined, lang: Lang) {
  if (!c) return '';
  return lang === 'ru' ? c.nameRu : lang === 'en' ? c.nameEn : c.nameUz;
}

export function tashkentToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');
