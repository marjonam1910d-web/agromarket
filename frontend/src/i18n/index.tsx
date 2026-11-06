import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import uz, { type Dict } from './uz';
import ru from './ru';
import en from './en';

export type Lang = 'uz' | 'ru' | 'en';
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'uz', label: "O'zbekcha", short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
];
const dicts: Record<Lang, Dict> = { uz, ru, en };

type Leaves<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Leaves<T[K]>}` }[keyof T & string];
export type TKey = Leaves<Dict>;
export type TFn = (key: TKey, params?: Record<string, string | number>) => string;

function lookup(d: Dict, key: string): string | undefined {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), d) as string | undefined;
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>) {
  const raw = lookup(dicts[lang], key) ?? lookup(uz, key) ?? key;
  return params ? raw.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k] ?? '')) : raw;
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('am_lang') as Lang | null;
    if (saved && saved in dicts) return saved;
  } catch {
    /* storage mavjud emas */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : 'uz';
  return nav === 'ru' ? 'ru' : 'uz';
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
}
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('am_lang', l);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error('I18nProvider kerak');
  return c;
}
