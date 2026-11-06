import crypto from 'node:crypto';

const map: Record<string, string> = {
  "o'": 'o', "g'": 'g', 'oʻ': 'o', 'gʻ': 'g', sh: 'sh', ch: 'ch',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

export function slugify(input: string): string {
  let s = input.toLowerCase().trim();
  s = s.replace(/[oʻ'g`’]/g, (c) => (c === 'ʻ' || c === '`' || c === '’' ? "'" : c));
  s = s
    .split('')
    .map((c) => map[c] ?? c)
    .join('');
  return s
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function uniqueSlug(base: string) {
  return `${slugify(base) || 'item'}-${crypto.randomBytes(3).toString('hex')}`;
}

/** O'zbekiston telefon raqamini +998XXXXXXXXX ko'rinishiga keltiradi */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let d = digits;
  if (d.length === 9) d = `998${d}`;
  if (d.length !== 12 || !d.startsWith('998')) return null;
  return `+${d}`;
}

export const PHONE_RE = /^\+998\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function sha256(v: string) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Asia/Tashkent bo'yicha bugungi sana (YYYY-MM-DD) */
export function tashkentToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function maskPhone(p?: string | null) {
  if (!p) return p;
  return p.replace(/^(\+998\d{2})\d{3}(\d{2})(\d{2})$/, '$1***$2$3');
}

export const DELIVERY_SLOTS = ['09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'] as const;
