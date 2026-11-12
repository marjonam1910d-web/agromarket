import { env } from '../../config/env';
import { logger } from '../../lib/logger';

/**
 * Xabarlarni tarjima qilish (ixtiyoriy tashqi xizmat).
 *  - google: Google Cloud Translation v2 (TRANSLATE_API_KEY)
 *  - libre : LibreTranslate (TRANSLATE_URL, ixtiyoriy TRANSLATE_API_KEY) — o'z serveringizda bepul ishlatish mumkin
 * Sozlanmagan bo'lsa — tarjima tugmasi ko'rinmaydi (yolg'on tarjima ko'rsatilmaydi).
 */
export const translateEnabled = () =>
  (env.TRANSLATE_PROVIDER === 'google' && Boolean(env.TRANSLATE_API_KEY)) || (env.TRANSLATE_PROVIDER === 'libre' && Boolean(env.TRANSLATE_URL));

export async function translate(text: string, to: 'uz' | 'ru' | 'en'): Promise<string | null> {
  if (!translateEnabled() || !text.trim()) return null;
  try {
    if (env.TRANSLATE_PROVIDER === 'google') {
      const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(env.TRANSLATE_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: to, format: 'text' }),
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await r.json()) as { data?: { translations?: { translatedText: string }[] } };
      return j.data?.translations?.[0]?.translatedText ?? null;
    }
    const r = await fetch(`${env.TRANSLATE_URL.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: to, format: 'text', ...(env.TRANSLATE_API_KEY ? { api_key: env.TRANSLATE_API_KEY } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as { translatedText?: string };
    return j.translatedText ?? null;
  } catch (e) {
    logger.warn('Tarjima xatosi', { err: (e as Error).message });
    return null;
  }
}
