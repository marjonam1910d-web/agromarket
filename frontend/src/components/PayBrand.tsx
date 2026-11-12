import type { ReactNode } from 'react';
import { Banknote, BellRing, CreditCard, FlaskConical, Mail, MessageSquareText, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { cx } from '@/utils/format';

/**
 * To'lov tizimlari belgilari. Rasmiy logotiplar emas — har biri o'z rangidagi matnli belgi
 * (Payme — moviy, Click — ko'k, Uzum — binafsha, Humo/Uzcard — o'z ranglari).
 */
const MARKS: Record<string, { bg: string; node: ReactNode }> = {
  payme: { bg: 'bg-[#E6FAFA] ring-[#00BFC4]/30', node: <span className="font-black tracking-tight"><span className="text-[#0B2E4F]">pay</span><span className="text-[#00B5BA]">me</span></span> },
  click: { bg: 'bg-[#EAF2FF] ring-[#0F6CF2]/30', node: <span className="flex items-center gap-1 font-black text-[#0F6CF2]"><span className="h-2 w-2 rounded-full bg-[#0F6CF2]" />click</span> },
  uzum: { bg: 'bg-[#F2E9FF] ring-[#7000FF]/25', node: <span className="font-black text-[#7000FF]">uzum</span> },
  humo: { bg: 'bg-[#1E1B24] ring-black/20', node: <span className="font-black italic text-[#FFB547]">HUMO</span> },
  uzcard: { bg: 'bg-[#0F4F6B] ring-black/10', node: <span className="font-black"><span className="text-white">UZ</span><span className="text-[#7FE3D6]">CARD</span></span> },
};

export function ProviderMark({ id, className }: { id: string; className?: string }) {
  const { t } = useI18n();
  const m = MARKS[id];
  if (m) return <span className={cx('inline-flex h-6 items-center rounded-md px-2 text-[12px] leading-none ring-1', m.bg, className)}>{m.node}</span>;
  const Icon = id === 'cash' ? Banknote : id === 'sandbox' ? FlaskConical : id === 'card' ? CreditCard : Wallet;
  const tone = id === 'cash' ? 'bg-brand-50 text-brand-800 ring-brand/20' : id === 'sandbox' ? 'bg-sun-100 text-amber-800 ring-amber-300/40' : 'bg-cream-100 text-ink-soft ring-cream-300';
  return (
    <span className={cx('inline-flex h-6 items-center gap-1 rounded-md px-2 text-[12px] font-bold ring-1', tone, className)}>
      <Icon className="h-3.5 w-3.5" />
      {t(`z.pay.p_${id}` as TKey) !== `z.pay.p_${id}` ? t(`z.pay.p_${id}` as TKey) : id}
    </span>
  );
}

/** "cash · cash" o'rniga: belgi + o'zbekcha nom (Naqd pul, Payme orqali, Sinov to'lovi …) */
export function PaymentMethod({ method, provider }: { method: string; provider?: string | null }) {
  const { t } = useI18n();
  const id = provider && provider !== method && provider !== 'cash' ? provider : method;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <ProviderMark id={id === 'card' ? 'card' : id} />
      <span className="text-sm text-ink-soft">{t(`z.pay.m_${method}` as TKey)}</span>
    </span>
  );
}

type Integrations = { payments: Record<string, string>; channels: Record<string, string> };

/** Sozlamalar → Integratsiyalar: har bir xizmat kartochkada, holati foydalanuvchi tilida */
export function IntegrationsPanel({ data, compact }: { data: Integrations; compact?: boolean }) {
  const { t } = useI18n();
  const items: { id: string; mark?: string; icon?: typeof Mail; status: string; hint: TKey }[] = [
    { id: 'payme', mark: 'payme', status: data.payments.payme ?? 'off', hint: 'z.int.h_payme' },
    { id: 'click', mark: 'click', status: data.payments.click ?? 'off', hint: 'z.int.h_click' },
    { id: 'uzum', mark: 'uzum', status: data.payments.uzum ?? 'off', hint: 'z.int.h_uzum' },
    { id: 'card', icon: CreditCard, status: data.payments.card ? 'via' : 'off', hint: 'z.int.h_card' },
    { id: 'sandbox', mark: 'sandbox', status: data.payments.sandbox ?? 'off', hint: 'z.int.h_sandbox' },
    ...(compact ? [] : [
      { id: 'sms', icon: MessageSquareText, status: data.channels.sms ?? 'off', hint: 'z.int.h_sms' as TKey },
      { id: 'email', icon: Mail, status: data.channels.email ?? 'off', hint: 'z.int.h_email' as TKey },
      { id: 'push', icon: BellRing, status: data.channels.push ?? 'off', hint: 'z.int.h_push' as TKey },
    ]),
  ];
  const tone = (s: string) => (['live', 'on', 'via', 'eskiz', 'smtp', 'gmail_https'].includes(s) ? 'bg-brand-50 text-brand-800' : s === 'test' ? 'bg-sky-50 text-sky-800' : s === 'pending' ? 'bg-cream-100 text-muted' : 'bg-sun-100 text-amber-800');
  const label = (id: string, s: string) => {
    if (id === 'card') return t('z.int.s_via', { p: (data.payments.card ?? '').replace(/^\w/, (c) => c.toUpperCase()) });
    if (id === 'sandbox') return t(s === 'on' ? 'z.int.s_sandbox_on' : 'z.int.s_sandbox_off');
    if (['eskiz', 'smtp', 'gmail_https'].includes(s)) return t('z.int.s_connected', { p: s === 'gmail_https' ? 'Gmail' : s === 'smtp' ? 'SMTP' : 'Eskiz' });
    return t(`z.int.s_${s}` as TKey);
  };
  return (
    <div className={cx('grid gap-2.5', compact ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-4')}>
      {items.map((x) => (
        <div key={x.id} className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-cream-200">
          <div className="flex items-center justify-between gap-2">
            {x.mark ? <ProviderMark id={x.mark} /> : x.icon && <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink"><x.icon className="h-4 w-4 text-brand" />{t(`z.int.n_${x.id}` as TKey)}</span>}
            <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', tone(x.status))}>{label(x.id, x.status)}</span>
          </div>
          {!compact && <p className="text-xs leading-snug text-muted">{t(x.hint)}</p>}
        </div>
      ))}
    </div>
  );
}
