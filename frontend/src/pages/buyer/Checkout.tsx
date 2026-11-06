import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, MapPin, Plus, ShieldCheck, Smartphone, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useCart, useConfig, useErrorText } from '@/hooks';
import { addDays, cx, money, normalizePhone, tashkentToday, phone as fmtPhone, date } from '@/utils/format';
import { useAuth } from '@/store/auth';
import { Badge, Button, Card, Checkbox, Field, Input, Skeleton, Textarea } from '@/components/ui';
import { RegionDistrictSelect } from '@/components/common';
import { CartSummary } from './Cart';
import type { Address, PaymentMethod } from '@/types';

type NewAddr = { recipientName: string; phone: string; region: string; district: string | null; street: string; landmark: string };

export default function Checkout() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();
  const err = useErrorText();
  const { user } = useAuth();
  const cfg = useConfig();
  const addresses = useQuery({ queryKey: ['addresses'], queryFn: () => api.get<Address[]>('/users/me/addresses') });
  const [addrId, setAddrId] = useState<string | 'new' | null>(null);
  const [addr, setAddr] = useState<NewAddr>({ recipientName: user?.fullName ?? '', phone: user?.phone ?? '', region: '', district: null, street: '', landmark: '' });
  const [saveAddr, setSaveAddr] = useState(true);
  const today = tashkentToday();
  const [deliveryDate, setDate] = useState(addDays(today, 1));
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idem = useRef(crypto.randomUUID());

  useEffect(() => {
    if (addrId === null && addresses.data) setAddrId(addresses.data.find((a) => a.isDefault)?.id ?? addresses.data[0]?.id ?? 'new');
  }, [addresses.data, addrId]);
  useEffect(() => {
    if (!slot && cfg.data?.deliverySlots.length) setSlot(cfg.data.deliverySlots[0]);
  }, [cfg.data, slot]);

  const selected = addresses.data?.find((a) => a.id === addrId);
  const dest = selected ? { region: selected.region, district: selected.district } : addr.region && addr.district ? { region: addr.region, district: addr.district } : {};
  const cart = useCart(dest as { region?: string; district?: string });
  const minLead = useMemo(() => Math.max(0, ...(cart.data?.groups.map((g) => g.eta?.minDays ?? 0) ?? [0])), [cart.data]);
  useEffect(() => {
    if (deliveryDate < addDays(today, minLead)) setDate(addDays(today, minLead));
  }, [minLead, deliveryDate, today]);
  const dates = Array.from({ length: Math.min(cfg.data?.maxDaysAhead ?? 7, 10) - minLead + 1 }, (_, i) => addDays(today, minLead + i)).filter(Boolean);

  const place = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { deliveryDate, deliverySlot: slot, deliveryNotes: notes || null, paymentMethod: method, termsAccepted: true };
      if (selected) body.addressId = selected.id;
      else body.address = { ...addr, phone: normalizePhone(addr.phone) ?? addr.phone, district: addr.district, landmark: addr.landmark || null };
      if (!selected) body.saveAddress = saveAddr;
      return api.post<{ order: { id: string; orderNumber: string }; payment: { id: string; checkoutUrl: string | null; provider: string } | null }>('/orders/checkout', body, { 'Idempotency-Key': idem.current });
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['cart'] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
      if (r.payment && r.payment.provider !== 'cash' && r.payment.checkoutUrl) {
        if (r.payment.provider === 'sandbox') nav(new URL(r.payment.checkoutUrl).pathname);
        else window.location.href = r.payment.checkoutUrl;
      } else nav(`/checkout/success/${r.order.id}`);
    },
    onError: (e) => {
      idem.current = crypto.randomUUID();
      setError(err(e));
    },
  });

  const validAddr = selected || (addr.recipientName.trim().length >= 2 && normalizePhone(addr.phone) && addr.region && addr.district && addr.street.trim().length >= 3);
  const deliverable = cart.data?.groups.every((g) => g.deliverable !== false);
  const canPlace = Boolean(validAddr && slot && terms && cart.data && !cart.data.hasIssues && deliverable && cart.data.itemCount);

  if (cart.data && !cart.data.itemCount) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><p className="font-bold">{t('cart.empty')}</p><Link to="/catalog"><Button className="mt-4">{t('nav.catalog')}</Button></Link></div>;

  const methods: { k: PaymentMethod; icon: typeof Banknote; label: TKey; color: string }[] = [
    { k: 'cash', icon: Banknote, label: 'checkout.cash', color: 'text-brand' },
    { k: 'payme', icon: Smartphone, label: 'checkout.payme', color: 'text-cyan-600' },
    { k: 'click', icon: Smartphone, label: 'checkout.click', color: 'text-blue-600' },
    { k: 'card', icon: CreditCard, label: 'checkout.card', color: 'text-amber-600' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-2xl font-extrabold text-ink sm:text-3xl">{t('checkout.title')}</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* 1. Manzil */}
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">1</span>{t('checkout.address')}</h2>
            {addresses.isLoading ? <Skeleton className="h-20" /> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {addresses.data?.map((a) => (
                  <button key={a.id} onClick={() => setAddrId(a.id)} className={cx('rounded-xl border-2 p-3 text-left transition', addrId === a.id ? 'border-brand bg-brand-50/50' : 'border-cream-200 hover:border-brand-200')}>
                    <p className="flex items-center gap-1.5 font-bold"><MapPin className="h-4 w-4 text-brand" />{a.label}{a.isDefault && <Badge className="ml-auto">{t('account.default')}</Badge>}</p>
                    <p className="mt-1 text-sm text-ink-soft">{a.street}, {a.district}</p>
                    <p className="text-xs text-muted">{a.recipientName} · {fmtPhone(a.phone)}</p>
                  </button>
                ))}
                <button onClick={() => setAddrId('new')} className={cx('flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 font-semibold', addrId === 'new' ? 'border-brand text-brand' : 'border-cream-300 text-muted')}>
                  <Plus className="h-4 w-4" />{t('checkout.newAddress')}
                </button>
              </div>
            )}
            {addrId === 'new' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('checkout.recipient')}><Input value={addr.recipientName} onChange={(e) => setAddr({ ...addr, recipientName: e.target.value })} autoComplete="name" /></Field>
                  <Field label={t('common.phone')} error={addr.phone && !normalizePhone(addr.phone) ? t('validation.phone') : undefined}><Input value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} inputMode="tel" placeholder="+998 90 123 45 67" autoComplete="tel" /></Field>
                </div>
                <RegionDistrictSelect region={addr.region} district={addr.district} onChange={(r, d) => setAddr({ ...addr, region: r, district: d })} />
                <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                  <Field label={t('checkout.street')}><Input value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} autoComplete="street-address" /></Field>
                  <Field label={<>{t('checkout.landmark')} <span className="text-muted">({t('common.optional')})</span></>}><Input value={addr.landmark} onChange={(e) => setAddr({ ...addr, landmark: e.target.value })} /></Field>
                </div>
                <Checkbox checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} label={t('checkout.saveAddress')} />
              </motion.div>
            )}
          </Card>

          {/* 2. Yetkazish */}
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">2</span>{t('checkout.step2')}</h2>
            <p className="mb-2 text-sm font-semibold">{t('checkout.date')}</p>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {dates.map((d) => (
                <button key={d} onClick={() => setDate(d)} className={cx('shrink-0 rounded-xl px-3 py-2 text-center text-sm font-semibold ring-1', deliveryDate === d ? 'bg-brand text-white ring-brand' : 'bg-white ring-cream-200')}>
                  {d === today ? t('common.today') : date(d, lang, { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
              ))}
            </div>
            <p className="mb-2 mt-4 text-sm font-semibold">{t('checkout.slot')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {cfg.data?.deliverySlots.map((s) => (
                <button key={s} onClick={() => setSlot(s)} className={cx('rounded-xl py-2 text-sm font-semibold ring-1', slot === s ? 'bg-brand text-white ring-brand' : 'bg-white ring-cream-200')}>{s}</button>
              ))}
            </div>
            <Field label={t('checkout.notes')} className="mt-4"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} /></Field>
          </Card>

          {/* 3. To'lov */}
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-sm text-white">3</span>{t('checkout.payment')}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {methods.map((m) => {
                const enabled = cfg.data?.paymentMethods[m.k] ?? m.k === 'cash';
                return (
                  <button key={m.k} disabled={!enabled} onClick={() => setMethod(m.k)} className={cx('flex items-center gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-40', method === m.k ? 'border-brand bg-brand-50/50' : 'border-cream-200 hover:border-brand-200')}>
                    <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-cream-200', m.color)}><m.icon className="h-5 w-5" /></span>
                    <span className="flex-1 font-bold">{t(m.label)}{!enabled && <span className="block text-xs font-normal text-muted">{t('checkout.unavailable')}</span>}</span>
                    {method === m.k && <CheckCircle2 className="h-5 w-5 text-brand" />}
                  </button>
                );
              })}
            </div>
            {method !== 'cash' && cfg.data?.paymentSandbox && <p className="mt-3 flex items-start gap-2 rounded-xl bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t('checkout.sandboxNote')}</p>}
            <p className="mt-3 flex items-center gap-2 text-xs text-muted"><ShieldCheck className="h-4 w-4 text-brand" />{t('checkout.cardSafe')}</p>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {cart.data ? (
            <CartSummary quote={cart.data}>
              <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto border-t border-cream-200 pt-3 text-sm">
                {cart.data.groups.flatMap((g) => g.items).map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate text-ink-soft">{l.name} × {Number(l.quantity)}</span><span className="font-semibold">{money(l.lineTotal, lang)}</span></li>)}
              </ul>
              {cart.data.groups.some((g) => g.deliverable === false) && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-danger">{t('errors.NOT_DELIVERABLE')}</p>}
              <div className="mt-4"><Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} label={<span className="text-xs">{t('checkout.terms')}</span>} /></div>
              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
              <Button block size="lg" className="mt-4" disabled={!canPlace} loading={place.isPending} onClick={() => { setError(null); place.mutate(); }}>
                {place.isPending ? t('checkout.placing') : t('checkout.place')}
              </Button>
            </CartSummary>
          ) : <Skeleton className="h-64" />}
        </div>
      </div>
    </div>
  );
}

export function CheckoutSuccess() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const o = useQuery({ queryKey: ['orders', id], queryFn: () => api.get<{ orderNumber: string }>(`/orders/${id}`) });
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand text-white shadow-glow"><CheckCircle2 className="h-10 w-10" /></motion.div>
      <h1 className="mt-5 text-2xl font-extrabold">{t('checkout.success')}</h1>
      <p className="mt-2 text-muted">{t('checkout.successHint', { n: o.data?.orderNumber ?? '…' })}</p>
      <div className="mt-6 flex justify-center gap-2"><Link to={`/account/orders/${id}`}><Button>{t('checkout.toOrder')}</Button></Link><Link to="/catalog"><Button variant="outline">{t('nav.catalog')}</Button></Link></div>
    </div>
  );
}

/** Provayderdan qaytgach — to'lov holati serverdan so'raladi (frontend "paid" deb belgilamaydi) */
export function PaymentResult() {
  const [sp] = useSearchParams();
  const { t, lang } = useI18n();
  const id = sp.get('payment') ?? '';
  const q = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api.get<{ status: string; orderId: string; orderNumber: string; amount: string; checkoutUrl: string | null; provider: string }>(`/payments/${id}`),
    refetchInterval: (query) => (['pending', 'processing'].includes(query.state.data?.status ?? 'pending') ? 3000 : false),
    enabled: Boolean(id),
  });
  const s = q.data?.status;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {!q.data || s === 'pending' || s === 'processing' ? (
        <><Loader2 className="mx-auto h-14 w-14 animate-spin text-brand" /><h1 className="mt-4 text-xl font-extrabold">{t('checkout.pending')}</h1></>
      ) : s === 'paid' ? (
        <><CheckCircle2 className="mx-auto h-16 w-16 text-success" /><h1 className="mt-4 text-2xl font-extrabold">{t('checkout.paid')}</h1><p className="mt-1 text-muted">{q.data.orderNumber} · {money(q.data.amount, lang)}</p></>
      ) : (
        <><XCircle className="mx-auto h-16 w-16 text-danger" /><h1 className="mt-4 text-2xl font-extrabold">{t('checkout.failed')}</h1></>
      )}
      {q.data && (
        <div className="mt-6 flex justify-center gap-2">
          <Link to={`/account/orders/${q.data.orderId}`}><Button>{t('checkout.toOrder')}</Button></Link>
        </div>
      )}
    </div>
  );
}

/** Sandbox to'lov sahifasi — faqat development (backend productionda bu endpointni o'chiradi) */
export function SandboxPay() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const err = useErrorText();
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => api.get<{ amount: string; orderNumber: string; status: string; method: string }>(`/payments/${id}`) });
  const [e, setE] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (result: 'success' | 'fail') => api.post(`/payments/sandbox/${id}/complete`, { result }),
    onSuccess: () => nav(`/checkout/result?payment=${id}`),
    onError: (x) => setE(err(x)),
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-cream p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="bg-sun px-5 py-2 text-center text-xs font-extrabold tracking-widest text-brand-900">{t('common.sandbox')}</div>
        <div className="p-6">
          <h1 className="text-xl font-extrabold">{t('sandbox.title')}</h1>
          <p className="mt-2 text-sm text-muted">{t('sandbox.text')}</p>
          {q.data && (
            <div className="mt-5 rounded-2xl bg-cream-100 p-4">
              <p className="text-xs text-muted">{t('sandbox.amount')} · {q.data.orderNumber} · {q.data.method.toUpperCase()}</p>
              <p className="text-3xl font-extrabold">{money(q.data.amount, lang)}</p>
            </div>
          )}
          {e && <p className="mt-3 text-sm text-danger">{e}</p>}
          <div className="mt-5 space-y-2">
            <Button block size="lg" loading={act.isPending && act.variables === 'success'} disabled={q.data?.status !== 'pending'} onClick={() => act.mutate('success')}>{t('sandbox.pay')}</Button>
            <Button block variant="outline" disabled={q.data?.status !== 'pending'} onClick={() => act.mutate('fail')}>{t('sandbox.fail')}</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
