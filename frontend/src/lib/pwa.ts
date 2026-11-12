import { useEffect, useState } from 'react';

/**
 * PWA: ilovani telefonga/kompyuterga o'rnatish.
 *  - Android / Chrome / Edge: `beforeinstallprompt` hodisasi → bitta tugma bilan o'rnatiladi.
 *  - iPhone (Safari): Apple avtomatik o'rnatishga ruxsat bermaydi → "Ulashish → Bosh ekranga qo'shish" yo'riqnomasi ko'rsatiladi.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export function registerPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    try {
      localStorage.setItem('am_installed', '1');
    } catch {
      /* ignore */
    }
    emit();
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  const standalone = isStandalone();
  return {
    standalone,
    /** Brauzer o'zi o'rnatish oynasini ko'rsata oladi */
    canPrompt: Boolean(deferred) && !standalone,
    ios: isIos(),
    /** Tugmani ko'rsatish kerakmi (allaqachon ilova ichida bo'lsa — yo'q) */
    available: !standalone,
    async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
      if (!deferred) return 'unavailable';
      await deferred.prompt();
      const r = await deferred.userChoice;
      deferred = null;
      emit();
      return r.outcome;
    },
  };
}
