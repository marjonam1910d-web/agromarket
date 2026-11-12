import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/store/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Lock, Plus, Star, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, ApiError } from '@/services/api';
import { useErrorText } from '@/hooks';
import { useToast } from '@/store/toast';
import { cx } from '@/utils/format';
import { Badge, Button, Empty, Field, Input, Modal, Skeleton } from '@/components/ui';

export interface SavedCard {
  id: string;
  maskedPan: string;
  expire: string;
  brand: 'UZCARD' | 'HUMO' | string;
  label: string | null;
  isDefault: boolean;
  sandbox: boolean;
}
interface CardOptions {
  mode: 'payme' | 'sandbox' | 'disabled';
  paymeMerchantId: string | null;
  paymeTest: boolean;
  sandboxSmsCode: string | null;
}

export const useCards = () => useQuery({ queryKey: ['cards'], queryFn: () => api.get<SavedCard[]>('/payments/cards') });

export type CardBrand = 'UZCARD' | 'HUMO' | null;
/** Raqam boshiga qarab tizimni aniqlash: 8600/5614 — Uzcard, 9860 — Humo */
export const brandOf = (pan: string): CardBrand => {
  const d = pan.replace(/\D/g, '');
  if (d.startsWith('9860')) return 'HUMO';
  if (d.startsWith('8600') || d.startsWith('5614')) return 'UZCARD';
  return null;
};

function Chip() {
  return (
    <svg viewBox="0 0 46 34" className="h-[26px] w-[35px] sm:h-[30px] sm:w-[40px]" aria-hidden>
      <defs>
        <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6E3A1" /><stop offset=".45" stopColor="#D4AF5A" /><stop offset="1" stopColor="#A47C2C" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="44" height="32" rx="6" fill="url(#chipg)" stroke="#8C6A24" strokeWidth=".8" />
      <path d="M1 12h13M1 22h13M32 12h13M32 22h13M14 1v32M32 1v32M14 17h18" stroke="#8C6A24" strokeWidth=".8" fill="none" opacity=".75" />
    </svg>
  );
}
function Contactless({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M8.5 8.5a5 5 0 0 1 0 7" /><path d="M12 6a8.5 8.5 0 0 1 0 12" /><path d="M15.5 3.5a12 12 0 0 1 0 17" />
    </svg>
  );
}
/** Faqat matnli belgi (rasmiy logotip emas) */
function Wordmark({ brand }: { brand: CardBrand }) {
  if (brand === 'HUMO') return <span className="font-black italic tracking-tight text-[#FFB547] [font-size:1.15em]">HUMO</span>;
  if (brand === 'UZCARD') return <span className="font-black tracking-[0.06em] [font-size:1.05em]"><span className="text-white">UZ</span><span className="text-[#7FE3D6]">CARD</span></span>;
  return <CreditCard className="h-6 w-6 text-white/80" />;
}

const SKIN: Record<'UZCARD' | 'HUMO' | 'NONE', string> = {
  UZCARD: 'bg-[radial-gradient(120%_140%_at_0%_0%,#2C8C8C_0%,#0F4F6B_45%,#0A2540_100%)]',
  HUMO: 'bg-[radial-gradient(120%_140%_at_100%_0%,#4A3A2A_0%,#1E1B24_50%,#0B0B10_100%)]',
  NONE: 'bg-[radial-gradient(120%_140%_at_0%_0%,#2F7A55_0%,#16432F_60%,#0C2A1D_100%)]',
};

/** Bank kartasiga o'xshash ko'rinish: chip, kontaktsiz belgisi, raqam, egasi, amal qilish muddati */
export function BankCard({ brand, pan, expire, holder, label, compact, badge }: { brand: CardBrand; pan: string; expire: string; holder?: string; label?: string | null; compact?: boolean; badge?: ReactNode }) {
  const { t } = useI18n();
  const skin = SKIN[brand ?? 'NONE'];
  return (
    <div className={cx('relative w-full overflow-hidden rounded-[18px] text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,.55)] ring-1 ring-white/10', skin, compact ? 'p-3.5 text-[13px]' : 'aspect-[1.586/1] p-4 sm:p-5')}>
      {/* gilosh naqsh — bank kartalaridagi mayda chiziqlar */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.13]" viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M-20 ${150 - i * 9} C 60 ${90 - i * 7}, 150 ${210 - i * 9}, 340 ${70 - i * 4}`} fill="none" stroke="white" strokeWidth=".7" />
        ))}
      </svg>
      {brand === 'HUMO' && <span className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[#FF9F2E]/25 blur-2xl" aria-hidden />}
      {brand === 'UZCARD' && <span className="pointer-events-none absolute -bottom-24 -left-10 h-60 w-60 rounded-full bg-[#5FE0C8]/20 blur-2xl" aria-hidden />}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-white/[0.14]" aria-hidden />

      <div className="relative flex items-start justify-between">
        <span className="max-w-[60%] truncate text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">{label || 'AgroMarket'}</span>
        <span className="text-lg sm:text-xl"><Wordmark brand={brand} /></span>
      </div>
      {!compact && (
        <div className="relative mt-4 flex items-center gap-3 sm:mt-6">
          <Chip />
          <Contactless className="h-6 w-6 text-white/80" />
        </div>
      )}
      <p className={cx('relative font-mono font-semibold tracking-[0.14em] [text-shadow:0_1px_1px_rgba(0,0,0,.35)]', compact ? 'mt-2 text-[15px]' : 'mt-3 text-[19px] sm:mt-4 sm:text-[22px]')}>{pan}</p>
      <div className={cx('relative flex items-end justify-between gap-3', compact ? 'mt-1.5' : 'mt-3 sm:mt-4')}>
        {!compact && (
          <div className="min-w-0">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/55">{t('y.card.holder')}</p>
            <p className="truncate text-[13px] font-semibold uppercase tracking-wider">{holder || '—'}</p>
          </div>
        )}
        <div className={cx('shrink-0', compact ? '' : 'text-right')}>
          {!compact && <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/55">{t('y.card.valid')}</p>}
          <p className="font-mono text-[13px] font-semibold">{expire || 'MM/YY'}</p>
        </div>
        {badge && <span className="absolute -top-1 right-0 flex items-center gap-1 sm:static">{badge}</span>}
      </div>
    </div>
  );
}

/** Saqlangan karta (bank kartasi ko'rinishida) */
export function CardFace({ card, compact, selected, onClick }: { card: SavedCard; compact?: boolean; selected?: boolean; onClick?: () => void }) {
  const { user } = useAuth();
  const brand: CardBrand = card.brand === 'HUMO' ? 'HUMO' : card.brand === 'UZCARD' ? 'UZCARD' : brandOf(card.maskedPan);
  const pan = card.maskedPan.replace(/\*/g, '•');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx('block w-full rounded-[18px] text-left transition', onClick && 'hover:-translate-y-0.5', selected && 'ring-4 ring-sun ring-offset-2 ring-offset-cream')}
    >
      <BankCard
        brand={brand}
        pan={pan}
        expire={card.expire}
        holder={user?.fullName}
        label={card.label}
        compact={compact}
        badge={(card.isDefault || card.sandbox) && (
          <>
            {card.isDefault && <Star className="h-3.5 w-3.5 fill-sun text-sun" />}
            {card.sandbox && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">TEST</span>}
          </>
        )}
      />
    </button>
  );
}

const digits = (s: string) => s.replace(/\D/g, '');
const fmtPan = (s: string) => digits(s).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const fmtExp = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Payme Subscribe API (brauzer tomoni): karta raqami bizning serverga TEGMAYDI */
async function paymeRpc<T>(o: CardOptions, method: string, params: Record<string, unknown>): Promise<T> {
  const url = o.paymeTest ? 'https://checkout.test.paycom.uz/api' : 'https://checkout.paycom.uz/api';
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Auth': o.paymeMerchantId ?? '' }, body: JSON.stringify({ id: Date.now(), method, params }) });
  const j = (await r.json()) as { result?: T; error?: { message?: string | Record<string, string> } };
  if (j.error) throw new Error(typeof j.error.message === 'string' ? j.error.message : (j.error.message?.uz ?? j.error.message?.ru ?? 'Payme'));
  return j.result as T;
}

export function AddCardModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded?: (c: SavedCard) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const opts = useQuery({ queryKey: ['cards', 'options'], queryFn: () => api.get<CardOptions>('/payments/cards/options'), enabled: open });
  const [step, setStep] = useState<0 | 1>(0);
  const [pan, setPan] = useState('');
  const [exp, setExp] = useState('');
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const o = opts.data;

  const reset = () => {
    setStep(0);
    setPan('');
    setExp('');
    setLabel('');
    setCode('');
    setPending('');
    setError(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const start = async () => {
    setError(null);
    const n = digits(pan);
    if (n.length !== 16) return setError(t('x.cards.number'));
    if (!/^\d{2}\/\d{2}$/.test(exp)) return setError(t('x.cards.expire'));
    setBusy(true);
    try {
      if (o?.mode === 'payme') {
        const c = await paymeRpc<{ card: { token: string } }>(o, 'cards.create', { card: { number: n, expire: exp.replace('/', '') }, save: true });
        const v = await paymeRpc<{ phone: string }>(o, 'cards.get_verify_code', { token: c.card.token });
        setPending(c.card.token);
        setPhone(v.phone);
      } else {
        const r = await api.post<{ pending: string; phoneMask: string }>('/payments/cards/sandbox/start', { number: n, expire: exp });
        setPending(r.pending);
        setPhone(r.phoneMask);
      }
      setPan(''); // raqamni xotiradan darhol tozalaymiz
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? err(e) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    setBusy(true);
    try {
      let card: SavedCard;
      if (o?.mode === 'payme') {
        const v = await paymeRpc<{ card: { token: string } }>(o, 'cards.verify', { token: pending, code });
        card = await api.post<SavedCard>('/payments/cards/payme', { token: v.card.token, label: label || undefined });
      } else {
        card = await api.post<SavedCard>('/payments/cards/sandbox/verify', { pending, code, label: label || undefined });
      }
      await qc.invalidateQueries({ queryKey: ['cards'] });
      toast(t('x.cards.added'));
      onAdded?.(card);
      close();
    } catch (e) {
      setError(e instanceof ApiError ? err(e) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('x.cards.add')}>
      {o?.mode === 'disabled' ? (
        <p className="text-sm text-muted">{t('x.cards.disabled')}</p>
      ) : step === 0 ? (
        <div className="space-y-4">
          <motion.div key={brandOf(pan) ?? 'none'} initial={{ rotateY: -12, opacity: 0.6 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.35 }} style={{ perspective: 800 }}>
            <BankCard brand={brandOf(pan)} pan={digits(pan).slice(0, 16).padEnd(16, '•').replace(/(.{4})(?=.)/g, '$1 ')} expire={exp} holder={user?.fullName} label={label || null} />
          </motion.div>
          <Field label={t('x.cards.number')}>
            <Input value={fmtPan(pan)} onChange={(e) => setPan(e.target.value)} inputMode="numeric" autoComplete="cc-number" placeholder="8600 0000 0000 0000" left={<CreditCard className="h-4 w-4" />} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('x.cards.expire')}><Input value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" /></Field>
            <Field label={t('x.cards.label')}><Input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} placeholder={t('x.cards.labelPh')} /></Field>
          </div>
          {o?.sandboxSmsCode && <p className="rounded-lg bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800">{t('x.cards.sandboxHint', { code: o.sandboxSmsCode })}</p>}
          <p className="flex gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('x.cards.safe')}</p>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <Button block loading={busy || opts.isLoading} onClick={() => void start()}>{t('x.cards.next')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('x.cards.smsSent', { phone })}</p>
          <Field label={t('x.cards.smsCode')}>
            <Input value={code} onChange={(e) => setCode(digits(e.target.value).slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="text-center text-xl font-bold tracking-[0.4em]" />
          </Field>
          {o?.sandboxSmsCode && <p className="rounded-lg bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800">{t('x.cards.sandboxHint', { code: o.sandboxSmsCode })}</p>}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}>{t('common.back')}</Button>
            <Button block loading={busy} disabled={code.length !== 6} onClick={() => void verify()}>{t('x.cards.verify')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Sozlamalardagi "To'lov kartalari" bo'limi */
export function CardsManager() {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const cards = useCards();
  const [open, setOpen] = useState(false);
  const def = useMutation({ mutationFn: (id: string) => api.patch(`/payments/cards/${id}/default`), onSuccess: () => qc.invalidateQueries({ queryKey: ['cards'] }), onError: (e) => toast(err(e), 'error') });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/payments/cards/${id}`),
    onSuccess: () => { toast(t('x.cards.removed')); void qc.invalidateQueries({ queryKey: ['cards'] }); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div className="space-y-4">
      {cards.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="aspect-[1.6/1]" /><Skeleton className="aspect-[1.6/1]" /></div>
      ) : !cards.data?.length ? (
        <Empty icon={<CreditCard className="h-8 w-8" />} title={t('x.cards.empty')} hint={t('x.cards.text')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.data.map((c) => (
            <div key={c.id} className="space-y-2">
              <CardFace card={c} />
              <div className="flex items-center justify-between gap-2">
                {c.isDefault ? <Badge tone="green">{t('x.cards.isDefault')}</Badge> : (
                  <button type="button" onClick={() => def.mutate(c.id)} className="text-xs font-bold text-brand">{t('x.cards.makeDefault')}</button>
                )}
                <button type="button" onClick={() => del.mutate(c.id)} className="flex items-center gap-1 text-xs font-bold text-danger"><Trash2 className="h-3.5 w-3.5" />{t('x.cards.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('x.cards.add')}</Button>
      <p className="flex gap-2 text-xs text-muted"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('x.cards.safe')}</p>
      <AddCardModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
