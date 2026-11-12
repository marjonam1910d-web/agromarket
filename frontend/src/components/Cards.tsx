import { useState } from 'react';
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

/** Kartaning vizual ko'rinishi (Uzcard — yashil-ko'k, Humo — to'q sariq) */
export function CardFace({ card, compact, selected, onClick }: { card: SavedCard; compact?: boolean; selected?: boolean; onClick?: () => void }) {
  const humo = card.brand === 'HUMO';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cx(
        'relative w-full overflow-hidden rounded-2xl p-4 text-left text-white shadow-lg transition',
        humo ? 'bg-gradient-to-br from-[#F2994A] via-[#E2711D] to-[#9C4A12]' : 'bg-gradient-to-br from-brand-600 via-brand-800 to-[#0B3B5C]',
        compact ? 'aspect-auto' : 'aspect-[1.6/1]',
        onClick && 'hover:-translate-y-0.5',
        selected && 'ring-4 ring-sun ring-offset-2 ring-offset-cream',
      )}
    >
      <span className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
      <span className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/80">{card.label || (humo ? 'Humo' : 'Uzcard')}</span>
        <span className="rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-extrabold tracking-wider">{humo ? 'HUMO' : 'UZCARD'}</span>
      </div>
      <p className={cx('relative font-mono font-bold tracking-[0.12em]', compact ? 'mt-3 text-base' : 'mt-8 text-lg sm:text-xl')}>{card.maskedPan}</p>
      <div className="relative mt-2 flex items-center justify-between text-xs text-white/80">
        <span>{card.expire}</span>
        <span className="flex items-center gap-1">
          {card.isDefault && <Star className="h-3.5 w-3.5 fill-sun text-sun" />}
          {card.sandbox && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">TEST</span>}
        </span>
      </div>
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
          <div className="rounded-2xl bg-gradient-to-br from-brand-600 via-brand-800 to-[#0B3B5C] p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Uzcard · Humo</p>
            <p className="mt-6 font-mono text-lg tracking-[0.12em]">{fmtPan(pan) || '0000 0000 0000 0000'}</p>
            <p className="mt-2 text-xs text-white/70">{exp || 'MM/YY'}</p>
          </div>
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
