import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Delete, Fingerprint, LogOut, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/store/auth';
import { api, ApiError } from '@/services/api';
import { isStandalone } from '@/lib/pwa';
import { biometricAvailable, createCredential, getAssertion, type ChallengeResp } from '@/lib/webauthn';
import { cx } from '@/utils/format';
import { Logo } from '@/components/common';
import { Button } from '@/components/ui';

/**
 * Ilova qulfi (bank ilovalari kabi):
 *  - O'rnatilgan ilovada (standalone) PIN majburiy: o'rnatilmaguncha ilovadan foydalanib bo'lmaydi.
 *  - Ilova fonga o'tsa (boshqa ilovaga o'tish, "so'nggi ilovalar" ro'yxati, ekran o'chishi) yoki qayta ochilsa — qulflanadi.
 *  - PIN/biometrik serverda tekshiriladi; 5 marta xato → barcha sessiyalar yopiladi.
 *  - Tizimdan chiqilganda qulf so'ralmaydi — bosh sahifa ochiladi.
 */

const DEVICE_KEY = 'am_lock_device';
const BROWSER_KEY = 'am_lock_browser';
const PIN_LEN = 4;

type Stored = { userId: string; deviceId: string };
const store = {
  get(): Stored | null {
    try {
      return JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null') as Stored | null;
    } catch {
      return null;
    }
  },
  set(v: Stored | null) {
    try {
      if (v) localStorage.setItem(DEVICE_KEY, JSON.stringify(v));
      else localStorage.removeItem(DEVICE_KEY);
    } catch {
      /* storage yopiq */
    }
  },
  browser(): boolean {
    try {
      return localStorage.getItem(BROWSER_KEY) === '1';
    } catch {
      return false;
    }
  },
  setBrowser(on: boolean) {
    try {
      if (on) localStorage.setItem(BROWSER_KEY, '1');
      else localStorage.removeItem(BROWSER_KEY);
    } catch {
      /* ignore */
    }
  },
};

interface LockCtx {
  deviceId: string | null;
  status: 'idle' | 'none' | 'ready';
  biometric: boolean;
  required: boolean;
  enabled: boolean;
  browserLock: boolean;
  setBrowserLock: (on: boolean) => void;
  refresh: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  /** Fayl tanlash / kamera / to'lov sahifasi ochilganda bir marta qulflamaslik */
  suppressOnce: () => void;
}
const Ctx = createContext<LockCtx | null>(null);
export const useAppLock = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppLockProvider kerak');
  return c;
};

export function AppLockProvider({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'none' | 'ready'>('idle');
  const [biometric, setBiometric] = useState(false);
  const [locked, setLocked] = useState(true); // sovuq start: qulf holatidan boshlaymiz (status aniqlangach yechiladi)
  const [browserLock, setBrowserLockState] = useState(store.browser);
  const suppressUntil = useRef(0);
  const [bioOffer, setBioOffer] = useState<string | null>(null);
  const required = isStandalone();
  const enabled = Boolean(user) && status === 'ready' && (required || browserLock);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus('idle');
      setDeviceId(null);
      return;
    }
    const s = store.get();
    if (!s || s.userId !== user.id) {
      setStatus('none');
      setDeviceId(null);
      return;
    }
    try {
      const r = await api.get<{ exists: boolean; biometric?: boolean }>(`/security/app-lock/${s.deviceId}`);
      if (r.exists) {
        setDeviceId(s.deviceId);
        setBiometric(Boolean(r.biometric));
        setStatus('ready');
      } else {
        store.set(null);
        setDeviceId(null);
        setStatus('none');
      }
    } catch {
      // tarmoq xatosi: mavjud qurilma bilan davom etamiz (qulf baribir serverda tekshiriladi)
      setDeviceId(s.deviceId);
      setStatus('ready');
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Foydalanuvchi yo'q (sessiya tekshiruvi tugagach) — qulf yo'q
  useEffect(() => {
    if (!loading && !user) setLocked(false);
  }, [user, loading]);

  // Status aniqlangach: qulf yoqilmagan bo'lsa ochamiz
  useEffect(() => {
    if (status !== 'idle' && !enabled) setLocked(false);
  }, [status, enabled]);

  // Fonga o'tganda qulflash
  useEffect(() => {
    const onVis = () => {
      if (!enabled) return;
      if (document.visibilityState === 'hidden') {
        if (Date.now() < suppressUntil.current) return;
        setLocked(true);
      } else {
        suppressUntil.current = 0;
      }
    };
    const onPageHide = () => enabled && Date.now() >= suppressUntil.current && setLocked(true);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [enabled]);

  // Fayl tanlash (rasm yuklash, kamera) sahifani vaqtincha "yashiradi" — bu holatda qulflamaymiz
  useEffect(() => {
    const onDown = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input[type="file"], label:has(input[type="file"]), [data-external]')) suppressUntil.current = Date.now() + 120_000;
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);

  const setupPin = useCallback(
    async (pin: string) => {
      const d = await api.post<{ deviceId: string; biometric: boolean }>('/security/app-lock', { pin, name: deviceName() });
      store.set({ userId: user!.id, deviceId: d.deviceId });
      setDeviceId(d.deviceId);
      setBiometric(false);
      setStatus('ready');
      setLocked(false);
      if (await biometricAvailable()) setBioOffer(pin);
    },
    [user],
  );

  const setBrowserLock = useCallback((on: boolean) => {
    store.setBrowser(on);
    setBrowserLockState(on);
  }, []);

  const signOut = useCallback(
    async (redirect: string) => {
      setLocked(false);
      await logout({ redirect });
    },
    [logout],
  );

  const value: LockCtx = {
    deviceId,
    status,
    biometric,
    required,
    enabled,
    browserLock,
    setBrowserLock,
    refresh,
    setupPin,
    suppressOnce: () => {
      suppressUntil.current = Date.now() + 120_000;
    },
  };

  const mustSetup = Boolean(user) && required && status === 'none';
  const showLock = Boolean(user) && enabled && locked;

  return (
    <Ctx.Provider value={value}>
      <div aria-hidden={showLock || mustSetup} className={cx((showLock || mustSetup) && 'pointer-events-none select-none blur-md')}>
        {children}
      </div>
      <AnimatePresence>
        {mustSetup && <PinSetupScreen key="setup" onDone={setupPin} onLogout={() => void signOut('/')} />}
        {!mustSetup && bioOffer && deviceId && (
          <Shell key="bio">
            <BiometricOffer deviceId={deviceId} pin={bioOffer} onFinish={() => { setBioOffer(null); void refresh(); }} />
          </Shell>
        )}
        {!mustSetup && showLock && deviceId && (
          <LockScreen
            key="lock"
            deviceId={deviceId}
            biometric={biometric}
            onUnlock={() => setLocked(false)}
            onReset={() => {
              store.set(null);
              void signOut('/auth?lock=reset');
            }}
            onForgot={async () => {
              await api.del(`/security/devices/${deviceId}`).catch(() => undefined);
              store.set(null);
              await signOut('/auth');
            }}
          />
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

function deviceName() {
  const ua = navigator.userAgent;
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Qurilma';
  const br = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : /firefox/i.test(ua) ? 'Firefox' : '';
  return `${os}${br ? ` · ${br}` : ''}${isStandalone() ? ' · ilova' : ''}`;
}

/* ───────────────── PIN klaviatura ───────────────── */

export function PinPad({ value, onChange, onSubmit, error, extra, disabled }: { value: string; onChange: (v: string) => void; onSubmit: (v: string) => void; error?: boolean; extra?: ReactNode; disabled?: boolean }) {
  const press = (d: string) => {
    if (disabled || value.length >= PIN_LEN) return;
    const v = value + d;
    onChange(v);
    if (v.length === PIN_LEN) setTimeout(() => onSubmit(v), 120);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="flex flex-col items-center">
      <motion.div className="mb-8 flex gap-4" animate={error ? { x: [0, -10, 10, -8, 8, 0] } : { x: 0 }} transition={{ duration: 0.4 }} aria-live="polite">
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <span key={i} className={cx('h-4 w-4 rounded-full border-2 transition-all', i < value.length ? (error ? 'scale-110 border-danger bg-danger' : 'scale-110 border-brand bg-brand') : 'border-brand/40')} />
        ))}
      </motion.div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} disabled={disabled} className="h-[68px] w-[68px] rounded-full bg-white text-2xl font-bold text-ink shadow-sm ring-1 ring-cream-200 transition active:scale-95 active:bg-brand-50 disabled:opacity-50">
            {d}
          </button>
        ))}
        <span className="flex h-[68px] w-[68px] items-center justify-center">{extra}</span>
        <button type="button" onClick={() => press('0')} disabled={disabled} className="h-[68px] w-[68px] rounded-full bg-white text-2xl font-bold text-ink shadow-sm ring-1 ring-cream-200 transition active:scale-95 active:bg-brand-50 disabled:opacity-50">
          0
        </button>
        <button type="button" onClick={() => onChange(value.slice(0, -1))} aria-label="Delete" className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-muted transition active:scale-95">
          <Delete className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="fixed inset-0 z-[200] flex flex-col items-center overflow-y-auto bg-cream px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
    >
      <div className="mb-6"><Logo /></div>
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">{children}</div>
    </motion.div>
  );
}

/* ───────────────── Qulf ekrani ───────────────── */

function LockScreen({ deviceId, biometric, onUnlock, onReset, onForgot }: { deviceId: string; biometric: boolean; onUnlock: () => void; onReset: () => void; onForgot: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const triedBio = useRef(false);

  const bio = useCallback(async () => {
    setError(null);
    try {
      const c = await api.post<ChallengeResp>(`/security/app-lock/${deviceId}/biometric/challenge`, { purpose: 'get' });
      const a = await getAssertion(c);
      await api.post(`/security/app-lock/${deviceId}/biometric/verify`, a);
      onUnlock();
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }, [deviceId, onUnlock]);

  useEffect(() => {
    if (biometric && !triedBio.current) {
      triedBio.current = true;
      void bio();
    }
  }, [biometric, bio]);

  const submit = async (v: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/security/app-lock/${deviceId}/verify`, { pin: v });
      onUnlock();
    } catch (e) {
      setPin('');
      if (e instanceof ApiError && e.code === 'APP_LOCK_RESET') return onReset();
      if (e instanceof ApiError && e.code === 'DEVICE_NOT_FOUND') return onForgot();
      const left = e instanceof ApiError ? (e.details as { attemptsLeft?: number } | undefined)?.attemptsLeft : undefined;
      setError(left != null ? t('x.lock.attemptsLeft', { n: left }) : e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg"><ShieldCheck className="h-8 w-8" /></span>
      <p className="text-sm font-semibold text-muted">{t('x.lock.hello', { name: user?.fullName?.split(' ')[0] ?? '' })}</p>
      <h1 className="mb-6 mt-1 text-xl font-extrabold text-ink">{t('x.lock.unlockTitle')}</h1>
      <PinPad
        value={pin}
        onChange={(v) => { setPin(v); setError(null); }}
        onSubmit={(v) => void submit(v)}
        error={Boolean(error)}
        disabled={busy}
        extra={biometric ? (
          <button type="button" onClick={() => void bio()} aria-label={t('x.lock.useBiometric')} className="flex h-[68px] w-[68px] items-center justify-center rounded-full text-brand active:scale-95">
            <Fingerprint className="h-9 w-9" />
          </button>
        ) : null}
      />
      <p className="mt-5 min-h-5 text-center text-sm font-semibold text-danger" role="alert">{error}</p>
      <button type="button" onClick={onForgot} className="mt-4 text-sm font-semibold text-brand underline decoration-sun decoration-2 underline-offset-4">{t('x.lock.forgot')}</button>
    </Shell>
  );
}

/* ───────────────── PIN o'rnatish (majburiy) ───────────────── */

const WEAK = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '1212']);

export function PinSetupScreen({ onDone, onLogout }: { onDone: (pin: string) => Promise<void>; onLogout?: () => void }) {
  const { t } = useI18n();
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (v: string) => {
    if (!first) {
      if (WEAK.has(v)) {
        setError(t('x.lock.weak'));
        setPin('');
        return;
      }
      setFirst(v);
      setPin('');
      setError(null);
      return;
    }
    if (v !== first) {
      setError(t('x.lock.mismatch'));
      setFirst(null);
      setPin('');
      return;
    }
    setBusy(true);
    try {
      await onDone(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setFirst(null);
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-lg"><ShieldCheck className="h-8 w-8" /></span>
      <h1 className="text-xl font-extrabold text-ink">{first ? t('x.lock.confirmTitle') : t('x.lock.setupTitle')}</h1>
      <p className="mb-6 mt-2 min-h-5 text-center text-sm text-muted">{first ? '' : t('x.lock.setupText')}</p>
      <PinPad value={pin} onChange={(v) => { setPin(v); setError(null); }} onSubmit={(v) => void submit(v)} error={Boolean(error)} disabled={busy} />
      <p className="mt-5 min-h-5 text-center text-sm font-semibold text-danger" role="alert">{error}</p>
      <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-center text-xs text-brand-700">{t('x.lock.required')}</p>
      {onLogout && (
        <button type="button" onClick={onLogout} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted"><LogOut className="h-4 w-4" />{t('x.lock.logout')}</button>
      )}
    </Shell>
  );
}

export async function enrollBiometric(deviceId: string, pin: string) {
  const c = await api.post<ChallengeResp>(`/security/app-lock/${deviceId}/biometric/challenge`, { purpose: 'create' });
  const cred = await createCredential(c);
  await api.post(`/security/app-lock/${deviceId}/biometric/register`, { pin, ...cred });
}

function BiometricOffer({ deviceId, pin, onFinish }: { deviceId: string | null; pin: string; onFinish: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center text-center">
      <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-brand">
        <Fingerprint className="h-14 w-14" />
      </motion.span>
      <h1 className="text-xl font-extrabold text-ink">{t('x.lock.biometric')}</h1>
      <p className="mb-6 mt-2 text-sm text-muted">{t('x.lock.biometricAsk')}</p>
      {error && <p className="mb-3 text-sm font-semibold text-danger">{error}</p>}
      <Button
        block
        size="lg"
        className="rounded-full"
        loading={busy}
        disabled={!deviceId}
        onClick={async () => {
          if (!deviceId) return;
          setBusy(true);
          setError(null);
          try {
            await enrollBiometric(deviceId, pin);
            onFinish();
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t('x.lock.biometricUnavailable'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Fingerprint className="h-5 w-5" />
        {t('x.lock.biometricYes')}
      </Button>
      <button type="button" onClick={onFinish} className="mt-4 text-sm font-semibold text-muted">{t('x.lock.biometricNo')}</button>
    </div>
  );
}
