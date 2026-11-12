import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronRight, CreditCard, Fingerprint, Globe, KeyRound, LogOut, MonitorSmartphone, ShieldCheck, Smartphone, Stamp, Trash2, User as UserIcon } from 'lucide-react';
import { LANGS, useI18n, type Lang, type TKey } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { api, ApiError } from '@/services/api';
import { cx, dateTime } from '@/utils/format';
import { biometricAvailable } from '@/lib/webauthn';
import { useInstallPrompt } from '@/lib/pwa';
import { enrollBiometric, PinPad, useAppLock } from '@/security/AppLock';
import { Badge, Button, Card, Checkbox, Field, Input, Modal, PasswordInput } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { CardsManager } from '@/components/Cards';
import { InstallAppButton } from '@/components/InstallApp';
import { Seal, type SealData } from '@/components/Seal';

type SectionId = 'profile' | 'security' | 'cards' | 'seal' | 'language' | 'app' | 'help';
const SECTIONS: { id: SectionId; icon: typeof UserIcon; label: TKey; roles?: string[] }[] = [
  { id: 'profile', icon: UserIcon, label: 'x.settings.profile' },
  { id: 'security', icon: ShieldCheck, label: 'x.settings.security' },
  { id: 'cards', icon: CreditCard, label: 'x.settings.cards', roles: ['BUYER', 'SELLER'] },
  { id: 'seal', icon: Stamp, label: 'y.seal.title', roles: ['BUYER', 'SELLER'] },
  { id: 'language', icon: Globe, label: 'x.settings.language' },
  { id: 'app', icon: Smartphone, label: 'x.settings.app' },
  { id: 'help', icon: BookOpen, label: 'x.settings.help' },
];

function Section({ title, text, children }: { title: string; text?: string; children: ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      </div>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const items = SECTIONS.filter((s) => !s.roles || (user && s.roles.includes(user.role)));
  const active = (items.find((s) => s.id === sp.get('s'))?.id ?? 'profile') as SectionId;
  const go = (id: SectionId) => setSp(id === 'profile' ? {} : { s: id }, { replace: true });

  return (
    <div className="max-w-5xl">
      <PageHeader title={t('account.settings')} />
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0" aria-label={t('account.settings')}>
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className={cx(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition lg:w-full',
                active === s.id ? 'bg-brand text-white shadow' : 'bg-white text-ink-soft ring-1 ring-cream-200 hover:bg-cream-100 lg:bg-transparent lg:ring-0',
              )}
            >
              <s.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{t(s.label)}</span>
              <ChevronRight className="hidden h-4 w-4 opacity-50 lg:block" />
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {active === 'profile' && <ProfileSection />}
          {active === 'security' && <SecuritySection />}
          {active === 'cards' && (
            <Section title={t('x.cards.title')} text={t('x.cards.text')}><CardsManager /></Section>
          )}
          {active === 'seal' && <SealSection />}
          {active === 'language' && <LanguageSection />}
          {active === 'app' && <AppSection />}
          {active === 'help' && (
            <Section title={t('x.help.title')} text={t('x.settings.helpText')}>
              <Link to="/help" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white"><BookOpen className="h-4 w-4" />{t('x.settings.openHelp')}</Link>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

const SEAL_COLORS = ['#1F4D36', '#1E3A8A', '#7F1D1D', '#4C1D95', '#111827'];
function SealSection() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['seal'], queryFn: () => api.get<SealData | null>('/contracts/seal') });
  const [title, setTitle] = useState(user?.fullName ?? '');
  const [color, setColor] = useState(SEAL_COLORS[0]);
  const [pressed, setPressed] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post<SealData>('/contracts/seal', { title: title.trim(), color }),
    onSuccess: (s) => { setPressed(true); qc.setQueryData(['seal'], s); toast(t('y.seal.created')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const seal = q.data;
  return (
    <Section title={t('y.seal.title')} text={t('y.seal.text')}>
      {q.isLoading ? null : seal ? (
        <div className="flex flex-wrap items-center gap-5">
          <div className="rounded-2xl bg-cream-50 p-3"><Seal seal={seal} size={150} pressed={pressed} /></div>
          <div className="text-sm">
            <p className="text-muted">{t('y.seal.code')}</p>
            <p className="font-mono text-lg font-extrabold text-ink">{seal.code}</p>
            <p className="mt-2 font-bold">{seal.title}</p>
          </div>
        </div>
      ) : (
        <div className="grid items-center gap-5 sm:grid-cols-[1fr_170px]">
          <div className="space-y-3">
            <p className="rounded-xl bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800">{t('y.seal.none')}</p>
            <Field label={t('y.seal.titleLabel')}><Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">{t('y.seal.color')}</p>
              <div className="flex gap-2">{SEAL_COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={cx('h-8 w-8 rounded-full ring-2 ring-offset-2 transition', color === c ? 'ring-ink' : 'ring-transparent')} style={{ background: c }} />)}</div>
            </div>
            <Button loading={m.isPending} disabled={title.trim().length < 2} onClick={() => m.mutate()}><Stamp className="h-4 w-4" />{t('y.seal.create')}</Button>
          </div>
          <div className="justify-self-center opacity-70"><Seal seal={{ code: 'AM-•••••-•••••', title: title || '—', subtitle: user?.fullName, color }} size={150} /></div>
        </div>
      )}
    </Section>
  );
}

function ProfileSection() {
  const { t, lang } = useI18n();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const err = useErrorText();
  const [name, setName] = useState(user?.fullName ?? '');
  const [wholesale, setWholesale] = useState(user?.buyerProfile?.isWholesale ?? false);
  const [company, setCompany] = useState(user?.buyerProfile?.companyName ?? '');
  const save = useMutation({
    mutationFn: () => api.patch<typeof user>('/users/me', { fullName: name, locale: lang, ...(user?.role === 'BUYER' ? { buyer: { isWholesale: wholesale, companyName: company || null } } : {}) }),
    onSuccess: (u) => { setUser(u); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Section title={t('x.settings.profile')}>
      <Field label={t('auth.fullName')}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('common.phone')}><Input value={user?.phone ?? '—'} disabled /></Field>
        <Field label={t('common.email')}><Input value={user?.email ?? '—'} disabled /></Field>
      </div>
      {user?.role === 'BUYER' && (
        <>
          <Checkbox checked={wholesale} onChange={(e) => setWholesale(e.target.checked)} label={t('account.wholesaleBuyer')} />
          {wholesale && <Field label={t('auth.company')}><Input value={company} onChange={(e) => setCompany(e.target.value)} /></Field>}
        </>
      )}
      <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
    </Section>
  );
}

function LanguageSection() {
  const { t, lang, setLang } = useI18n();
  const { user, setUser } = useAuth();
  const change = async (l: Lang) => {
    setLang(l);
    const u = await api.patch<typeof user>('/users/me', { locale: l }).catch(() => null);
    if (u) setUser(u);
  };
  return (
    <Section title={t('x.settings.language')}>
      <div className="grid gap-2 sm:grid-cols-3">
        {LANGS.map((l) => (
          <button key={l.code} type="button" onClick={() => void change(l.code)} className={cx('rounded-xl px-4 py-3 text-left font-bold ring-1 transition', lang === l.code ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-cream-200 hover:ring-brand')}>
            <span className="block text-xs opacity-70">{l.short}</span>
            {l.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function AppSection() {
  const { t } = useI18n();
  const p = useInstallPrompt();
  return (
    <Section title={t('x.settings.app')} text={t('x.settings.appText')}>
      {p.standalone ? (
        <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700"><ShieldCheck className="h-4 w-4" />{t('x.settings.installed')}</p>
      ) : (
        <InstallAppButton variant="ghost" />
      )}
    </Section>
  );
}

function SecuritySection() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const toast = useToast();
  const err = useErrorText();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const pass = useMutation({
    mutationFn: () => api.post('/users/me/password', { currentPassword: cur, newPassword: next }),
    onSuccess: async () => { toast(t('auth.resetDone')); await logout({ redirect: '/auth' }); },
    onError: (e) => toast(err(e), 'error'),
  });
  const all = useMutation({ mutationFn: () => api.post('/auth/logout-all'), onSuccess: () => logout({ redirect: '/auth' }) });
  return (
    <>
      <AppLockSection />
      <Section title={t('account.changePassword')}>
        <Field label={t('account.currentPassword')}><PasswordInput value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></Field>
        <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}><PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
        <Button variant="outline" disabled={!cur || next.length < 8} loading={pass.isPending} onClick={() => pass.mutate()}><KeyRound className="h-4 w-4" />{t('common.save')}</Button>
      </Section>
      <DevicesSection />
      <Section title={t('x.settings.danger')} text={t('x.settings.sessionsText')}>
        <Button variant="danger" loading={all.isPending} onClick={() => all.mutate()}><LogOut className="h-4 w-4" />{t('account.logoutAll')}</Button>
      </Section>
    </>
  );
}

function AppLockSection() {
  const { t } = useI18n();
  const toast = useToast();
  const lock = useAppLock();
  const [bioOk, setBioOk] = useState(false);
  const [mode, setMode] = useState<null | 'setup' | 'change' | 'bio'>(null);
  useEffect(() => {
    void biometricAvailable().then(setBioOk);
  }, []);
  const on = lock.status === 'ready';
  return (
    <Section title={t('x.lock.sectionTitle')} text={t('x.lock.sectionText')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted">{t('x.lock.status')}:</span>
        <Badge tone={on ? 'green' : 'gray'}>{on ? t('x.lock.on') : t('x.lock.off')}</Badge>
        {on && lock.biometric && <Badge tone="blue"><Fingerprint className="mr-1 inline h-3 w-3" />{t('x.lock.biometric')}</Badge>}
      </div>
      <p className="text-xs text-muted">{t('x.lock.appOnly')}</p>
      <div className="flex flex-wrap gap-2">
        {!on ? (
          <Button onClick={() => setMode('setup')}><ShieldCheck className="h-4 w-4" />{t('x.lock.setup')}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMode('change')}><KeyRound className="h-4 w-4" />{t('x.lock.changePin')}</Button>
            {bioOk && !lock.biometric && <Button variant="outline" onClick={() => setMode('bio')}><Fingerprint className="h-4 w-4" />{t('x.lock.biometric')}: {t('x.lock.enableBiometric')}</Button>}
            {lock.biometric && (
              <Button
                variant="outline"
                onClick={async () => {
                  await api.del(`/security/app-lock/${lock.deviceId}/biometric`);
                  await lock.refresh();
                  toast(t('x.lock.biometricOff'));
                }}
              >
                <Fingerprint className="h-4 w-4" />{t('x.lock.disableBiometric')}
              </Button>
            )}
          </>
        )}
      </div>
      {on && !lock.required && <Checkbox checked={lock.browserLock} onChange={(e) => lock.setBrowserLock(e.target.checked)} label={t('x.lock.lockInBrowser')} />}
      <PinFlowModal mode={mode} onClose={() => setMode(null)} />
    </Section>
  );
}

/** PIN o'rnatish / o'zgartirish / biometrikni yoqish (joriy PIN bilan) */
function PinFlowModal({ mode, onClose }: { mode: null | 'setup' | 'change' | 'bio'; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const lock = useAppLock();
  const [step, setStep] = useState(0);
  const [cur, setCur] = useState('');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStep(0);
    setCur('');
    setFirst('');
    setPin('');
    setError(null);
  }, [mode]);
  const needCurrent = mode === 'change' || mode === 'bio';
  const title = mode === 'setup' ? t('x.lock.setupTitle') : mode === 'change' ? t('x.lock.changePin') : t('x.lock.biometric');
  const label = needCurrent && step === 0 ? t('x.lock.currentPin') : (mode === 'setup' ? step === 0 : step === 1) ? t('x.lock.newPin') : t('x.lock.confirmTitle');

  const fail = (e: unknown) => {
    setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : t('common.error'));
    setPin('');
  };

  const submit = async (v: string) => {
    setError(null);
    if (mode === 'bio') {
      setBusy(true);
      try {
        await enrollBiometric(lock.deviceId!, v);
        await lock.refresh();
        toast(t('x.lock.biometricOn'));
        onClose();
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (needCurrent && step === 0) {
      setCur(v);
      setPin('');
      setStep(1);
      return;
    }
    const isNew = mode === 'setup' ? step === 0 : step === 1;
    if (isNew) {
      setFirst(v);
      setPin('');
      setStep(step + 1);
      return;
    }
    if (v !== first) {
      setError(t('x.lock.mismatch'));
      setFirst('');
      setPin('');
      setStep(mode === 'setup' ? 0 : 1);
      return;
    }
    setBusy(true);
    try {
      if (mode === 'setup') await lock.setupPin(v);
      else {
        await api.put(`/security/app-lock/${lock.deviceId}/pin`, { currentPin: cur, pin: v });
        toast(t('x.lock.pinChanged'));
      }
      onClose();
    } catch (e) {
      fail(e);
      setStep(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={mode !== null} onClose={onClose} title={title}>
      <p className="mb-5 text-center text-sm font-bold text-ink">{mode === 'bio' ? t('x.lock.currentPin') : label}</p>
      <PinPad value={pin} onChange={(v) => { setPin(v); setError(null); }} onSubmit={(v) => void submit(v)} error={Boolean(error)} disabled={busy} />
      <p className="mt-4 min-h-5 text-center text-sm font-semibold text-danger" role="alert">{error}</p>
    </Modal>
  );
}

function DevicesSection() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const lock = useAppLock();
  const list = useQuery({ queryKey: ['security', 'devices'], queryFn: () => api.get<{ deviceId: string; name: string | null; biometric: boolean; createdAt: string; lastUnlockAt: string | null }[]>('/security/devices') });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/security/devices/${id}`),
    onSuccess: async () => {
      toast(t('x.lock.removed'));
      await qc.invalidateQueries({ queryKey: ['security', 'devices'] });
      await lock.refresh();
    },
  });
  if (!list.data?.length) return null;
  return (
    <Section title={t('x.lock.devices')}>
      <ul className="divide-y divide-cream-200">
        {list.data.map((d) => (
          <li key={d.deviceId} className="flex items-center gap-3 py-3">
            <MonitorSmartphone className="h-5 w-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {d.name ?? '—'} {d.deviceId === lock.deviceId && <Badge tone="green" className="ml-1">{t('x.lock.thisDevice')}</Badge>}
              </p>
              <p className="text-xs text-muted">{t('x.lock.lastUnlock')}: {d.lastUnlockAt ? dateTime(d.lastUnlockAt) : '—'}{d.biometric ? ' · 👆' : ''}</p>
            </div>
            <button type="button" onClick={() => remove.mutate(d.deviceId)} className="flex items-center gap-1 text-xs font-bold text-danger"><Trash2 className="h-3.5 w-3.5" />{t('x.lock.remove')}</button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
