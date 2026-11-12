import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, Check, Mail, Phone, PlayCircle, ShoppingCart, Sprout } from 'lucide-react';
import { useI18n, type TFn } from '@/i18n';
import { api } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useConfig, useErrorText, usePrefersReducedMotion } from '@/hooks';
import { cx, normalizePhone } from '@/utils/format';
import { Button, Checkbox, Field, Input, PasswordInput } from '@/components/ui';
import { LanguageSwitcher, Logo, RegionDistrictSelect } from '@/components/common';
import { dashboardPath } from '@/layouts/PublicLayout';
import { InstallAppButton } from '@/components/InstallApp';
import type { User } from '@/types';

type Mode = 'login' | 'signup';

/* ═════════════════ Dekor: urug'lar, barglar, bug'doy boshoqlari ═════════════════ */

function Seeds({ count = 18 }: { count?: number }) {
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ left: (i * 53) % 100, delay: (i * 0.73) % 6, dur: 5 + ((i * 1.7) % 4), size: 3 + (i % 3) })), [count]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden>
      {seeds.map((s, i) => (
        <span
          key={i}
          className="absolute bottom-6 animate-rise rounded-full bg-sun"
          style={{ left: `${s.left}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`, boxShadow: '0 0 10px 3px rgba(242,193,78,.55)' }}
        />
      ))}
    </div>
  );
}

/** Real fotosuratlar (Unsplash litsenziyasi — tijoriy foydalanish bepul) */
const PHOTO = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
export const AUTH_PHOTOS = {
  login: PHOTO('1560493676-04071c5f467b'), // quyosh botayotgan dala egatlari
  signup: PHOTO('1488459716781-31db52582fe9'), // bozordagi yangi meva-sabzavotlar
  buyer: PHOTO('1550989460-0adf9ea622e2', 240), // sabzavot rastasi
  seller: PHOTO('1625246333195-78d9c38ad449', 240), // tuproqdagi ko'chat
};

function PhotoScene({ mode }: { mode: Mode }) {
  return (
    <div className="absolute inset-0" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.img
          key={mode}
          src={mode === 'login' ? AUTH_PHOTOS.login : AUTH_PHOTOS.signup}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1.02, transition: { opacity: { duration: 0.8 }, scale: { duration: 14, ease: 'linear' } } }}
          exit={{ opacity: 0, transition: { duration: 0.6 } }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-brand-900/95 via-brand-900/55 to-brand-800/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900/40 to-transparent" />
    </div>
  );
}

/** Qiyshiq "egat" panel ichidagi kontent */
function BladeContent({ mode, t, compact }: { mode: Mode; t: TFn; compact?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <PhotoScene mode={mode} />
      <div className={cx('relative z-10 flex h-full flex-col px-12', compact ? 'justify-end pb-6' : 'justify-end pb-24')}>
        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.5 } }} exit={{ opacity: 0, y: -12, transition: { duration: 0.2 } }}>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-sun">AgroMarket</p>
            <h2 className="font-display text-4xl leading-[1.08] text-white">
              {mode === 'login' ? t('auth.welcomeBack') : t('auth.startTitle')}
              <br />
              <em className="text-lime">{mode === 'login' ? t('auth.welcomeBack2') : t('auth.startTitle2')}</em>
            </h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/80">{mode === 'login' ? t('auth.welcomeText') : t('auth.startText')}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      {!compact && <span className="absolute bottom-3 right-6 z-10 text-[10px] text-white/45">{t('x.auth.photoCredit')}</span>}
    </div>
  );
}

/* ═════════════════ Demo kirish ═════════════════ */

function DemoLogin() {
  const { t } = useI18n();
  const cfg = useConfig();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const errText = useErrorText();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!cfg.data?.demoMode) return null;
  const go = async (role: 'BUYER' | 'SELLER') => {
    setBusy(role);
    setError(null);
    try {
      const r = await api.post<{ user: User }>('/auth/demo-login', { role });
      setUser(r.user);
      nav(dashboardPath(r.user.role), { replace: true });
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-brand/30 bg-brand-50/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand"><PlayCircle className="h-4 w-4" />{t('x.auth.demoTitle')}</p>
      <p className="mt-0.5 text-xs text-muted">{t('x.auth.demoText')}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" className="bg-white" loading={busy === 'BUYER'} onClick={() => void go('BUYER')}><ShoppingCart className="h-4 w-4" />{t('x.auth.demoBuyer')}</Button>
        <Button type="button" size="sm" variant="outline" className="bg-white" loading={busy === 'SELLER'} onClick={() => void go('SELLER')}><Sprout className="h-4 w-4" />{t('x.auth.demoSeller')}</Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ═════════════════ Kirish formasi ═════════════════ */

function LoginForm({ onSwitch, onForgot }: { onSwitch: () => void; onForgot: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { setUser } = useAuth();
  const errText = useErrorText();
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [serverError, setServerError] = useState<string | null>(null);
  const schema = z.object({
    login: z.string().min(1, t('validation.required')).refine((v) => (tab === 'phone' ? Boolean(normalizePhone(v)) : /^\S+@\S+\.\S+$/.test(v)), tab === 'phone' ? t('validation.phone') : t('validation.email')),
    password: z.string().min(1, t('validation.required')),
    remember: z.boolean(),
  });
  type F = z.infer<typeof schema>;
  const { register, handleSubmit, formState, reset } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { login: '', password: '', remember: true } });
  useEffect(() => {
    reset({ login: '', password: '', remember: true });
  }, [tab, reset]);
  const onSubmit = async (v: F) => {
    setServerError(null);
    try {
      const login = tab === 'phone' ? normalizePhone(v.login)! : v.login.trim();
      const r = await api.post<{ user: User }>('/auth/login', { login, password: v.password, remember: v.remember });
      setUser(r.user);
      const next = sp.get('next');
      nav(next && next.startsWith('/') ? next : dashboardPath(r.user.role), { replace: true });
    } catch (e) {
      setServerError(errText(e));
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col" noValidate>
      <h1 className="text-2xl font-extrabold text-ink">{t('auth.signIn')}</h1>
      <span className="mt-2 h-0.5 w-8 rounded-full bg-sun" />
      <div className="mt-6 grid grid-cols-2 rounded-xl bg-cream-100 p-1" role="tablist">
        {(['phone', 'email'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('relative rounded-lg py-2 text-sm font-bold transition', tab === k ? 'text-white' : 'text-muted')}>
            {tab === k && <motion.span layoutId="logintab" className="absolute inset-0 rounded-lg bg-brand" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
            <span className="relative">{k === 'phone' ? t('auth.phoneTab') : t('auth.emailTab')}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-4">
        <Field error={formState.errors.login?.message}>
          {tab === 'phone' ? (
            <Input {...register('login')} inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" left={<span className="flex items-center gap-1 text-sm font-semibold text-ink">🇺🇿 +998</span>} className="pl-[88px]" invalid={Boolean(formState.errors.login)} aria-label={t('auth.phoneTab')} />
          ) : (
            <Input {...register('login')} type="email" autoComplete="email" placeholder="email@example.uz" left={<Mail className="h-4 w-4" />} invalid={Boolean(formState.errors.login)} aria-label="Email" />
          )}
        </Field>
        <Field error={formState.errors.password?.message}>
          <PasswordInput {...register('password')} autoComplete="current-password" placeholder={t('auth.password')} invalid={Boolean(formState.errors.password)} aria-label={t('auth.password')} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Checkbox {...register('remember')} label={t('auth.remember')} />
        <button type="button" onClick={onForgot} className="text-sm font-semibold text-brand underline decoration-sun decoration-2 underline-offset-4 hover:text-brand-700">{t('auth.forgot')}</button>
      </div>
      {serverError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-danger" role="alert">{serverError}</p>}
      <Button type="submit" size="lg" className="mt-5 rounded-full" loading={formState.isSubmitting} block>
        {t('auth.signIn')}
      </Button>
      <p className="mt-5 text-center text-sm text-muted">
        {t('auth.noAccount')}{' '}
        <button type="button" onClick={onSwitch} className="font-bold text-ink underline decoration-sun decoration-2 underline-offset-4">{t('auth.createAccount')}</button>
      </p>
      <DemoLogin />
    </form>
  );
}

/* ═════════════════ OTP kiritish ═════════════════ */

function OtpBoxes({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (d) {
        e.preventDefault();
        onChange(d);
        refs.current[Math.min(d.length, 5)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d.trim()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`digit ${i + 1}`}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, '').slice(-1);
            const arr = value.padEnd(6, ' ').split('');
            arr[i] = c || ' ';
            onChange(arr.join('').trimEnd());
            if (c) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i].trim()) refs.current[i - 1]?.focus();
          }}
          className={cx('h-14 w-full rounded-xl border-2 bg-white text-center text-2xl font-extrabold text-ink transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10', invalid ? 'border-danger' : 'border-cream-300')}
        />
      ))}
    </div>
  );
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return [left, setLeft] as const;
}

/* ═════════════════ Ro'yxatdan o'tish (bosqichma-bosqich) ═════════════════ */

function Stepper({ step, t }: { step: number; t: TFn }) {
  const labels = [t('auth.stepInfo'), t('auth.stepVerify'), t('auth.stepProfile')];
  return (
    <ol className="mb-5 flex items-center">
      {labels.map((l, i) => (
        <li key={l} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition', i < step ? 'bg-brand text-white' : i === step ? 'bg-brand text-white ring-4 ring-brand/15' : 'bg-cream-200 text-muted')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cx('text-[11px] font-semibold', i <= step ? 'text-brand' : 'text-muted')}>{l}</span>
          </div>
          {i < labels.length - 1 && <span className={cx('mx-1 mb-4 h-0.5 flex-1 rounded transition-colors', i < step ? 'bg-brand' : 'bg-cream-200')} />}
        </li>
      ))}
    </ol>
  );
}

function SignupForm({ onSwitch, initialRole }: { onSwitch: () => void; initialRole?: 'BUYER' | 'SELLER' }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const errText = useErrorText();
  const cfg = useConfig();
  const [role, setRole] = useState<'BUYER' | 'SELLER' | null>(initialRole ?? null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<'phone' | 'email'>('phone');
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpToken, setOtpToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useCountdown();

  const target = tab === 'phone' ? normalizePhone(contact) : contact.trim().toLowerCase();

  const sendCode = async () => {
    setError(null);
    if (fullName.trim().length < 3) return setError(t('validation.min', { n: 3 }));
    if (!target || (tab === 'email' && !/^\S+@\S+\.\S+$/.test(target))) return setError(tab === 'phone' ? t('validation.phone') : t('validation.email'));
    setBusy(true);
    try {
      const r = await api.post<{ resendIn: number; devCode?: string }>('/auth/otp/request', { target, purpose: 'REGISTER' });
      setDevCode(r.devCode ?? null);
      setLeft(r.resendIn);
      setStep(1);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (code.length !== 6) return setError(t('errors.OTP_INVALID'));
    setBusy(true);
    try {
      const r = await api.post<{ otpToken: string }>('/auth/otp/verify', { target, purpose: 'REGISTER', code });
      setOtpToken(r.otpToken);
      setStep(2);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  // ── 3-bosqich: parol va profil ──
  const schema = z
    .object({
      password: z.string().min(8, t('validation.password')).regex(/[A-Za-z]/, t('validation.password')).regex(/\d/, t('validation.password')),
      confirm: z.string(),
      terms: z.literal(true, { errorMap: () => ({ message: t('validation.terms') }) }),
      wholesale: z.boolean().optional(),
      company: z.string().optional(),
      farmName: z.string().optional(),
      region: z.string().optional(),
      district: z.string().optional(),
      address: z.string().optional(),
      tin: z.string().optional(),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: t('validation.match') })
    .superRefine((v, ctx) => {
      if (role !== 'SELLER') return;
      if (!v.farmName || v.farmName.trim().length < 2) ctx.addIssue({ code: 'custom', path: ['farmName'], message: t('validation.required') });
      if (!v.region) ctx.addIssue({ code: 'custom', path: ['region'], message: t('validation.required') });
      if (!v.district) ctx.addIssue({ code: 'custom', path: ['district'], message: t('validation.required') });
      if (!v.address || v.address.trim().length < 3) ctx.addIssue({ code: 'custom', path: ['address'], message: t('validation.required') });
      if (v.tin && !/^\d{9}$|^\d{14}$/.test(v.tin)) ctx.addIssue({ code: 'custom', path: ['tin'], message: 'STIR: 9 / 14' });
    });
  type F = z.infer<typeof schema>;
  const form = useForm<F>({ resolver: zodResolver(schema), defaultValues: { region: '', district: '', wholesale: false } as Partial<F> });
  const { register, formState, watch, setValue } = form;

  const finish = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const r = await api.post<{ user: User }>('/auth/register', {
        otpToken,
        fullName: fullName.trim(),
        password: v.password,
        role,
        termsAccepted: true,
        locale: lang,
        ...(role === 'BUYER' ? { buyer: { isWholesale: Boolean(v.wholesale), companyName: v.company || undefined } } : {}),
        ...(role === 'SELLER' ? { seller: { farmName: v.farmName, region: v.region, district: v.district, address: v.address, tin: v.tin || undefined } } : {}),
      });
      setUser(r.user);
      nav(role === 'SELLER' ? '/seller/profile' : '/catalog', { replace: true });
    } catch (e) {
      setError(errText(e));
    }
  });

  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28 } };

  return (
    <div className="flex w-full flex-col">
      <h1 className="text-2xl font-extrabold text-ink">{t('auth.signUp')}</h1>
      <span className="mb-5 mt-2 h-0.5 w-8 rounded-full bg-sun" />
      <AnimatePresence mode="wait">
        {!role ? (
          <motion.div key="role" {...slide} className="space-y-3">
            <p className="text-sm font-semibold text-muted">{t('auth.chooseRole')}</p>
            {([
              { r: 'BUYER' as const, icon: ShoppingCart, photo: AUTH_PHOTOS.buyer, title: t('auth.buyer'), desc: t('auth.buyerDesc') },
              { r: 'SELLER' as const, icon: Sprout, photo: AUTH_PHOTOS.seller, title: t('auth.seller'), desc: t('auth.sellerDesc') },
            ]).map((o) => (
              <button key={o.r} type="button" onClick={() => setRole(o.r)} className="group flex w-full items-center gap-4 rounded-2xl border-2 border-cream-200 bg-white p-4 text-left transition hover:border-brand hover:shadow-card">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-brand-50 transition group-hover:scale-105">
                  <img src={o.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-tl-lg bg-brand text-white"><o.icon className="h-3.5 w-3.5" /></span>
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-ink">{o.title}</span>
                  <span className="block text-sm text-muted">{o.desc}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
              </button>
            ))}
            <DemoLogin />
          </motion.div>
        ) : (
          <motion.div key="steps" {...slide}>
            <Stepper step={step} t={t} />
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="s0" {...slide} className="space-y-4">
                  <Field label={t('auth.fullName')}><Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aliyev Javohir" autoComplete="name" /></Field>
                  <div className="grid grid-cols-2 rounded-xl bg-cream-100 p-1">
                    {(['phone', 'email'] as const).map((k) => (
                      <button key={k} type="button" onClick={() => { setTab(k); setContact(''); }} className={cx('flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition', tab === k ? 'bg-brand text-white' : 'text-muted')}>
                        {k === 'phone' ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                        {k === 'phone' ? t('auth.phoneTab') : t('auth.emailTab')}
                      </button>
                    ))}
                  </div>
                  {tab === 'phone' ? (
                    <Input value={contact} onChange={(e) => setContact(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="90 123 45 67" left={<span className="text-sm font-semibold text-ink">🇺🇿 +998</span>} className="pl-[88px]" aria-label={t('auth.phoneTab')} />
                  ) : (
                    <Input value={contact} onChange={(e) => setContact(e.target.value)} type="email" autoComplete="email" placeholder="email@example.uz" left={<Mail className="h-4 w-4" />} aria-label="Email" />
                  )}
                  {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setRole(null)} aria-label={t('common.back')}><ArrowLeft className="h-4 w-4" /></Button>
                    <Button type="button" block className="rounded-full" loading={busy} onClick={() => void sendCode()}>{t('auth.sendCode')} <ArrowRight className="h-4 w-4" /></Button>
                  </div>
                </motion.div>
              )}
              {step === 1 && (
                <motion.div key="s1" {...slide} className="space-y-4">
                  <p className="text-sm text-muted">{t('auth.codeSent', { target: target ?? '' })}</p>
                  <OtpBoxes value={code} onChange={setCode} invalid={Boolean(error)} />
                  {devCode && cfg.data?.otpDevEcho && <p className="rounded-lg bg-sun-100 px-3 py-1.5 text-xs font-semibold text-amber-800">{t('auth.devCode', { code: devCode })}</p>}
                  {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <button type="button" className="font-semibold text-muted hover:text-ink" onClick={() => { setStep(0); setCode(''); }}><ArrowLeft className="mr-1 inline h-4 w-4" />{t('common.back')}</button>
                    <button type="button" disabled={left > 0 || busy} onClick={() => void sendCode()} className="font-semibold text-brand disabled:text-muted">{left > 0 ? t('auth.resendIn', { s: `00:${String(left).padStart(2, '0')}` }) : t('auth.resend')}</button>
                  </div>
                  <Button type="button" block className="rounded-full" loading={busy} onClick={() => void verify()}>{t('auth.verify')}</Button>
                </motion.div>
              )}
              {step === 2 && (
                <motion.form key="s2" {...slide} onSubmit={finish} className="space-y-3.5" noValidate>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('auth.password')} error={formState.errors.password?.message} hint={t('auth.passwordHint')}>
                      <PasswordInput {...register('password')} autoComplete="new-password" invalid={Boolean(formState.errors.password)} />
                    </Field>
                    <Field label={t('auth.passwordConfirm')} error={formState.errors.confirm?.message}>
                      <PasswordInput {...register('confirm')} autoComplete="new-password" invalid={Boolean(formState.errors.confirm)} />
                    </Field>
                  </div>
                  {role === 'SELLER' ? (
                    <>
                      <Field label={t('auth.farmName')} error={formState.errors.farmName?.message}><Input {...register('farmName')} placeholder="Bog'iston fermer xo'jaligi" /></Field>
                      <RegionDistrictSelect
                        region={watch('region') ?? ''}
                        district={watch('district') || null}
                        onChange={(r, d) => { setValue('region', r, { shouldValidate: formState.isSubmitted }); setValue('district', d ?? '', { shouldValidate: formState.isSubmitted }); }}
                        errors={{ region: formState.errors.region?.message, district: formState.errors.district?.message }}
                      />
                      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                        <Field label={t('auth.farmAddress')} error={formState.errors.address?.message}><Input {...register('address')} /></Field>
                        <Field label={<>{t('auth.tin')} <span className="font-normal text-muted">({t('common.optional')})</span></>} error={formState.errors.tin?.message}><Input {...register('tin')} inputMode="numeric" maxLength={14} /></Field>
                      </div>
                      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">{t('auth.sellerNote')}</p>
                    </>
                  ) : (
                    <>
                      <Checkbox {...register('wholesale')} label={t('auth.wholesale')} />
                      {watch('wholesale') && <Field label={t('auth.company')}><Input {...register('company')} /></Field>}
                    </>
                  )}
                  <Checkbox {...register('terms')} label={<>{t('auth.termsAccept')} <Link to="/about#terms" target="_blank" className="font-semibold text-brand underline">↗</Link></>} />
                  {formState.errors.terms && <p className="text-xs text-danger">{formState.errors.terms.message}</p>}
                  {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
                  <Button type="submit" block size="lg" className="rounded-full" loading={formState.isSubmitting}>{t('auth.finish')}</Button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-5 text-center text-sm text-muted">
        {t('auth.haveAccount')}{' '}
        <button type="button" onClick={onSwitch} className="font-bold text-ink underline decoration-sun decoration-2 underline-offset-4">{t('auth.signIn')}</button>
      </p>
    </div>
  );
}

/* ═════════════════ Parolni tiklash ═════════════════ */

function ForgotForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const cfg = useConfig();
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [pass, setPass] = useState('');
  const [dev, setDev] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const target = contact.includes('@') ? contact.trim().toLowerCase() : normalizePhone(contact);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-full">
      <h1 className="text-2xl font-extrabold text-ink">{t('auth.resetTitle')}</h1>
      <span className="mb-4 mt-2 block h-0.5 w-8 rounded-full bg-sun" />
      <p className="mb-4 text-sm text-muted">{t('auth.resetText')}</p>
      {step === 0 && (
        <div className="space-y-3">
          <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder={t('auth.loginLabel')} aria-label={t('auth.loginLabel')} />
          <Button block className="rounded-full" loading={busy} onClick={() => run(async () => {
            if (!target) throw new Error();
            const r = await api.post<{ devCode?: string }>('/auth/otp/request', { target, purpose: 'RESET_PASSWORD' });
            setDev(r.devCode ?? null);
            setStep(1);
          })}>{t('auth.sendCode')}</Button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3">
          <OtpBoxes value={code} onChange={setCode} />
          {dev && cfg.data?.otpDevEcho && <p className="rounded-lg bg-sun-100 px-3 py-1.5 text-xs font-semibold text-amber-800">{t('auth.devCode', { code: dev })}</p>}
          <Button block className="rounded-full" loading={busy} onClick={() => run(async () => {
            const r = await api.post<{ otpToken: string }>('/auth/otp/verify', { target, purpose: 'RESET_PASSWORD', code });
            setToken(r.otpToken);
            setStep(2);
          })}>{t('auth.verify')}</Button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}><PasswordInput value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" /></Field>
          <Button block className="rounded-full" loading={busy} onClick={() => run(async () => {
            await api.post('/auth/password/reset', { otpToken: token, password: pass });
            setMsg({ ok: true, text: t('auth.resetDone') });
            setStep(3);
          })}>{t('common.save')}</Button>
        </div>
      )}
      {msg && <p className={cx('mt-3 rounded-xl px-3 py-2 text-sm', msg.ok ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-danger')} role="status">{msg.text}</p>}
      <button type="button" onClick={onBack} className="mt-5 text-sm font-semibold text-brand"><ArrowLeft className="mr-1 inline h-4 w-4" />{t('auth.backToLogin')}</button>
    </div>
  );
}

/* ═════════════════ Sahifa ═════════════════ */

export default function AuthPage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const reduced = usePrefersReducedMotion();
  const mode: Mode = sp.get('mode') === 'signup' ? 'signup' : 'login';
  const [forgot, setForgot] = useState(false);
  const initialRole = sp.get('role') === 'SELLER' ? 'SELLER' : sp.get('role') === 'BUYER' ? 'BUYER' : undefined;
  useEffect(() => {
    if (user) nav(dashboardPath(user.role), { replace: true });
  }, [user, nav]);
  const setMode = (m: Mode) => {
    setForgot(false);
    const n = new URLSearchParams(sp);
    if (m === 'signup') n.set('mode', 'signup');
    else n.delete('mode');
    setSp(n, { replace: true });
  };
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)');
    const f = () => setDesktop(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  const spring = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 70, damping: 16, mass: 0.9 };

  const loginPane: ReactNode = forgot ? <ForgotForm onBack={() => setForgot(false)} /> : <LoginForm onSwitch={() => setMode('signup')} onForgot={() => setForgot(true)} />;
  const signupPane: ReactNode = <SignupForm onSwitch={() => setMode('login')} initialRole={initialRole} />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_#1A5C3B_0%,_#123B2A_45%,_#0A2318_100%)]">
      {/* fon: zarrachalar va egat chiziqlari */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(115deg, #8BC34A 0 1px, transparent 1px 42px)' }} aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-lime/10 blur-[120px]" aria-hidden />
      <Seeds count={26} />

      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo light />
        <div className="flex items-center gap-2">
          <InstallAppButton variant="light" className="hidden md:inline-flex" />
          <LanguageSwitcher dark />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-3 pb-10 sm:px-6">
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 hidden text-center font-display text-xl italic text-lime md:block">
          {t('brand.tagline')}
        </motion.p>

        {/* ── Desktop: qiyshiq "egat" panel sirpanadi ── */}
        {desktop ? (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-[660px] w-full max-w-[1040px] overflow-hidden rounded-[28px] bg-cream shadow-[0_40px_120px_-30px_rgba(0,0,0,.6)] ring-1 ring-white/10 md:block"
        >
          <div className="absolute inset-y-0 left-0 flex w-1/2 items-center overflow-y-auto py-10 pl-12 pr-24 no-scrollbar" aria-hidden={mode !== 'login'} {...(mode !== 'login' ? { inert: '' } : {})}>
            <motion.div className="w-full" animate={{ opacity: mode === 'login' ? 1 : 0, x: mode === 'login' ? 0 : -30 }} transition={{ duration: 0.4, delay: mode === 'login' ? 0.35 : 0 }}>
              {loginPane}
            </motion.div>
          </div>
          <div className="absolute inset-y-0 right-0 flex w-1/2 items-center overflow-y-auto py-10 pl-24 pr-12 no-scrollbar" aria-hidden={mode !== 'signup'} {...(mode !== 'signup' ? { inert: '' } : {})}>
            <motion.div className="w-full" animate={{ opacity: mode === 'signup' ? 1 : 0, x: mode === 'signup' ? 0 : 30 }} transition={{ duration: 0.4, delay: mode === 'signup' ? 0.35 : 0 }}>
              {signupPane}
            </motion.div>
          </div>

          {/* "Egat" — bitta qiyshiq to'rtburchak, faqat translateX bilan harakatlanadi */}
          <motion.div
            className="absolute inset-y-[-4%] z-20 w-[58%] overflow-hidden"
            style={{ skewX: '-9deg' }}
            initial={false}
            animate={{ left: mode === 'login' ? '47%' : '-5%' }}
            transition={spring}
          >
            <div className="absolute inset-0 bg-brand-900" />
            {/* yorug' choklar (seams) */}
            <span className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-transparent via-sun to-transparent opacity-90 shadow-[0_0_24px_4px_rgba(242,193,78,.5)]" />
            <span className="absolute inset-y-0 right-0 w-[3px] bg-gradient-to-b from-transparent via-lime to-transparent opacity-80 shadow-[0_0_24px_4px_rgba(139,195,74,.45)]" />
            <motion.div className="absolute inset-0" style={{ skewX: '9deg' }}>
              <motion.div
                className="absolute inset-y-0"
                style={{ width: '86%' }}
                initial={false}
                animate={{ left: mode === 'login' ? '10%' : '6%' }}
                transition={spring}
              >
                <BladeContent mode={mode} t={t} />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
        ) : (
        /* ── Mobil: animatsiyasiz, ilova uslubidagi ekran ── */
        <div className="w-full max-w-md overflow-hidden rounded-[26px] bg-cream shadow-2xl">
          <div className="relative h-48 overflow-hidden">
            <img src={mode === 'login' ? AUTH_PHOTOS.login : AUTH_PHOTOS.signup} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/95 via-brand-900/50 to-brand-900/10" />
            <div className="absolute inset-x-5 bottom-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sun">AgroMarket</p>
              <h2 className="mt-1 font-display text-[26px] leading-tight">
                {mode === 'login' ? t('auth.welcomeBack') : t('auth.startTitle')} <em className="text-lime">{mode === 'login' ? t('auth.welcomeBack2') : t('auth.startTitle2')}</em>
              </h2>
            </div>
          </div>
          <div className="px-5 pt-4">
            <div className="grid grid-cols-2 rounded-2xl bg-cream-100 p-1" role="tablist">
              {(['login', 'signup'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cx('rounded-xl py-2.5 text-sm font-bold transition', mode === m ? 'bg-white text-brand shadow-sm' : 'text-muted')}>
                  {m === 'login' ? t('x.auth.tabLogin') : t('x.auth.tabSignup')}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 pb-6 pt-5">{mode === 'login' ? loginPane : signupPane}</div>
          <div className="border-t border-cream-200 bg-white/60 px-5 py-4"><InstallAppButton block /></div>
        </div>
        )}
      </div>
    </div>
  );
}
