import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FilePen, FileSignature, FileText, Hash, Plus, Printer, QrCode, Send, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useErrorText } from '@/hooks';
import { useToast } from '@/store/toast';
import { useAuth } from '@/store/auth';
import { cx, date, dateTime, money, num } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, PasswordInput, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { Seal, type SealData } from '@/components/Seal';

type Status = 'draft' | 'pending' | 'signed' | 'rejected' | 'cancelled';
interface Item { name: string; quantity: number; unit: string; price: number; total?: number }
interface Terms {
  items: Item[];
  deliveryAddress: string;
  deliveryDate: string | null;
  deliveryTerms: string;
  paymentMethod: string;
  paymentTerms: string;
  prepaymentPercent: number;
  qualityTerms: string;
  penaltyPercentPerDay: number;
  penaltyMaxPercent: number;
  disputeResolution: string;
  extraTerms: string;
  buyer?: { name: string; phone: string | null; email: string | null; company: string | null };
  seller?: { name: string; farm: string; tin: string | null; address: string; phone: string | null };
}
interface Party { id: string; name: string; company?: string | null; farm?: string | null; seal: SealData | null }
interface Contract {
  id: string;
  number: string;
  publicId: string;
  verifyUrl: string;
  sellerOrderId: string | null;
  title: string;
  terms: Terms;
  totalAmount: string;
  status: Status;
  contentHash: string | null;
  createdById: string;
  sentAt: string | null;
  signedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  myRole: 'BUYER' | 'SELLER' | 'ADMIN' | null;
  buyer: Party;
  seller: Party;
  signatures: { userId: string; role: string; sealCode: string; signedAt: string; valid: boolean }[];
}

const TONE: Record<Status, 'gray' | 'yellow' | 'green' | 'red' | 'dark'> = { draft: 'gray', pending: 'yellow', signed: 'green', rejected: 'red', cancelled: 'dark' };
export function ContractStatus({ s }: { s: Status }) {
  const { t } = useI18n();
  return <Badge tone={TONE[s]}>{t(`y.contract.st_${s}` as TKey)}</Badge>;
}

/** Buyurtma sahifasidan: shartnoma tuzish / ochish */
export function ContractFromOrderButton({ sellerOrderId, size = 'sm' }: { sellerOrderId: string; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const err = useErrorText();
  const m = useMutation({
    mutationFn: () => api.post<{ id: string; existing: boolean }>(`/contracts/from-order/${sellerOrderId}`),
    onSuccess: (r) => nav(`/contracts/${r.id}`),
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Button size={size} variant="outline" loading={m.isPending} onClick={() => m.mutate()}>
      <FileSignature className="h-4 w-4" />
      {t('y.contract.fromOrder')}
    </Button>
  );
}

// ───────── Ro'yxat ─────────
export function ContractsList() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Status | 'all'>('all');
  const q = useQuery({ queryKey: ['contracts', tab], queryFn: () => api.get<Contract[]>(`/contracts${tab === 'all' ? '' : `?status=${tab}`}`) });
  return (
    <div>
      <PageHeader title={t('y.contract.title')} subtitle={t('y.contract.subtitle')} actions={<Link to="/contracts/new"><Button><Plus className="h-4 w-4" />{t('y.contract.new')}</Button></Link>} />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[{ value: 'all', label: t('y.users.all') }, ...(['pending', 'draft', 'signed', 'rejected'] as Status[]).map((s) => ({ value: s, label: t(`y.contract.st_${s}` as TKey) }))]}
      />
      {q.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : !q.data?.length ? (
        <Card className="p-8"><Empty icon={<FileText className="h-8 w-8" />} title={t('y.contract.empty')} hint={t('y.contract.emptyHint')} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((c) => {
            const other = c.myRole === 'BUYER' ? c.seller.farm ?? c.seller.name : c.buyer.company ?? c.buyer.name;
            const needMine = c.status === 'pending' && !c.signatures.some((s) => s.role === c.myRole);
            return (
              <Link key={c.id} to={`/contracts/${c.id}`} className="group rounded-2xl bg-white p-4 ring-1 ring-cream-200 transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">№ {c.number}</p>
                    <p className="mt-0.5 line-clamp-2 font-extrabold text-ink">{c.title}</p>
                  </div>
                  <ContractStatus s={c.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-ink-soft">{c.myRole === 'BUYER' ? t('y.contract.seller') : t('y.contract.buyer')}: <b>{other}</b></p>
                    <p className="text-xs text-muted">{date(c.createdAt, lang)} · {c.signatures.length}/2 ✍</p>
                  </div>
                  <p className="shrink-0 font-extrabold text-brand">{money(c.totalAmount, lang)}</p>
                </div>
                {needMine && <p className="mt-2 rounded-lg bg-sun-100 px-2 py-1 text-xs font-bold text-amber-800">✍ {t('y.contract.sign')}</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────── Shartlar muharriri ─────────
function TermsEditor({ value, onChange }: { value: Terms; onChange: (v: Terms) => void }) {
  const { t, lang } = useI18n();
  const set = <K extends keyof Terms>(k: K, v: Terms[K]) => onChange({ ...value, [k]: v });
  const total = value.items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{t('y.contract.items')}</p>
        <div className="space-y-2">
          {value.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-cream-100 p-2 sm:grid-cols-[2fr_1fr_90px_1fr_auto]">
              <Input className="col-span-2 sm:col-span-1" value={it.name} placeholder={t('y.contract.name')} onChange={(e) => set('items', value.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input type="number" min={0} value={it.quantity} placeholder={t('y.contract.qty')} onChange={(e) => set('items', value.items.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
              <Input value={it.unit} placeholder={t('y.contract.unit')} onChange={(e) => set('items', value.items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
              <Input type="number" min={0} value={it.price} placeholder={t('y.contract.price')} onChange={(e) => set('items', value.items.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
              <button type="button" disabled={value.items.length < 2} onClick={() => set('items', value.items.filter((_, j) => j !== i))} className="rounded-lg p-2 text-danger disabled:opacity-30" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => set('items', [...value.items, { name: '', quantity: 1, unit: 'kg', price: 0 }])} className="flex items-center gap-1 text-sm font-bold text-brand"><Plus className="h-4 w-4" />{t('y.contract.addItem')}</button>
          <p className="text-sm font-bold">{t('y.contract.total')}: <span className="text-brand">{money(total, lang)}</span></p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('y.contract.deliveryAddress')}><Input value={value.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} /></Field>
        <Field label={t('y.contract.deliveryDate')}><Input type="date" value={value.deliveryDate ?? ''} onChange={(e) => set('deliveryDate', e.target.value || null)} /></Field>
        <Field label={t('y.contract.prepayment')}><Input type="number" min={0} max={100} value={value.prepaymentPercent} onChange={(e) => set('prepaymentPercent', Number(e.target.value))} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('y.contract.penalty')}><Input type="number" step="0.05" min={0} max={5} value={value.penaltyPercentPerDay} onChange={(e) => set('penaltyPercentPerDay', Number(e.target.value))} /></Field>
          <Field label={t('y.contract.penaltyMax')}><Input type="number" min={0} max={100} value={value.penaltyMaxPercent} onChange={(e) => set('penaltyMaxPercent', Number(e.target.value))} /></Field>
        </div>
      </div>
      {(['deliveryTerms', 'paymentTerms', 'qualityTerms', 'disputeResolution', 'extraTerms'] as const).map((k) => (
        <Field key={k} label={t(({ deliveryTerms: 'y.contract.deliveryTerms', paymentTerms: 'y.contract.paymentTerms', qualityTerms: 'y.contract.qualityTerms', disputeResolution: 'y.contract.dispute', extraTerms: 'y.contract.extra' } as const)[k])}>
          <Textarea rows={k === 'extraTerms' ? 2 : 3} value={value[k]} onChange={(e) => set(k, e.target.value)} />
        </Field>
      ))}
    </div>
  );
}

const cleanTerms = (t: Terms) => ({
  items: t.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name.trim(), quantity: Number(i.quantity), unit: i.unit || 'kg', price: Number(i.price) })),
  deliveryAddress: t.deliveryAddress,
  deliveryDate: t.deliveryDate,
  deliveryTerms: t.deliveryTerms,
  paymentMethod: t.paymentMethod,
  paymentTerms: t.paymentTerms,
  prepaymentPercent: Number(t.prepaymentPercent),
  qualityTerms: t.qualityTerms,
  penaltyPercentPerDay: Number(t.penaltyPercentPerDay),
  penaltyMaxPercent: Number(t.penaltyMaxPercent),
  disputeResolution: t.disputeResolution,
  extraTerms: t.extraTerms,
});

// ───────── Yangi (erkin) shartnoma ─────────
export function ContractNew() {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const err = useErrorText();
  const [counterpart, setCounterpart] = useState('');
  const [title, setTitle] = useState('');
  const [terms, setTerms] = useState<Terms>({
    items: [{ name: '', quantity: 100, unit: 'kg', price: 0 }],
    deliveryAddress: '',
    deliveryDate: null,
    deliveryTerms: '',
    paymentMethod: 'platform',
    paymentTerms: '',
    prepaymentPercent: 0,
    qualityTerms: '',
    penaltyPercentPerDay: 0.1,
    penaltyMaxPercent: 10,
    disputeResolution: '',
    extraTerms: '',
  });
  const m = useMutation({
    mutationFn: () => {
      const tt = cleanTerms(terms);
      // bo'sh matnli shartlar — server standart matnni qo'yadi
      const body = Object.fromEntries(Object.entries(tt).filter(([, v]) => v !== '')) as typeof tt;
      return api.post<{ id: string }>('/contracts', { counterpart: counterpart.trim(), title: title.trim(), terms: body });
    },
    onSuccess: (r) => {
      toast(t('y.contract.created'));
      nav(`/contracts/${r.id}`);
    },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div className="max-w-4xl">
      <Link to="/contracts" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('y.contract.back')}</Link>
      <PageHeader title={t('y.contract.new')} />
      <Card className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('y.contract.counterpart')}><Input value={counterpart} onChange={(e) => setCounterpart(e.target.value)} placeholder="+998 90 123 45 67 / email" /></Field>
          <Field label={t('y.contract.titleLabel')}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kartoshka yetkazib berish shartnomasi" /></Field>
        </div>
        <TermsEditor value={terms} onChange={setTerms} />
        <Button size="lg" loading={m.isPending} disabled={counterpart.length < 5 || title.length < 5 || !terms.deliveryAddress} onClick={() => m.mutate()}><FilePen className="h-4 w-4" />{t('y.contract.save')}</Button>
      </Card>
    </div>
  );
}

// ───────── Hujjat ko'rinishi (shartnoma qog'ozi) ─────────
function Clause({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-1.5 font-bold text-ink">{title}</h3>
      <div className="space-y-1.5 text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export function ContractDocument({ c, qrSrc, justSigned }: { c: Pick<Contract, 'number' | 'title' | 'terms' | 'totalAmount' | 'createdAt' | 'contentHash' | 'buyer' | 'seller' | 'signatures' | 'status'>; qrSrc?: string; justSigned?: string | null }) {
  const { t, lang } = useI18n();
  const tm = c.terms;
  const sigOf = (role: string) => c.signatures.find((s) => s.role === role);
  const party = (role: 'BUYER' | 'SELLER') => {
    const p = role === 'BUYER' ? c.buyer : c.seller;
    const sig = sigOf(role);
    return (
      <div className="relative flex min-h-[170px] flex-col justify-between rounded-xl border border-dashed border-cream-300 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{role === 'BUYER' ? t('y.contract.buyer') : t('y.contract.seller')}</p>
          <p className="font-extrabold text-ink">{role === 'SELLER' ? tm.seller?.farm ?? p.farm ?? p.name : tm.buyer?.company ?? p.name}</p>
          <p className="text-sm text-ink-soft">{p.name}</p>
          {role === 'SELLER' && tm.seller?.tin && <p className="text-xs text-muted">{t('y.contract.tin')}: {tm.seller.tin}</p>}
          {role === 'SELLER' && tm.seller?.address && <p className="text-xs text-muted">{tm.seller.address}</p>}
        </div>
        <div className="mt-3 flex items-end justify-between gap-2">
          {sig ? (
            <div className="text-xs">
              <p className="font-bold text-brand">✍ {t('y.contract.signedBy')}</p>
              <p className="text-muted">{dateTime(sig.signedAt, lang)}</p>
              <p className="font-mono text-[10px] text-muted">{sig.sealCode}</p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-muted">— {t('y.contract.notSigned')} —</p>
          )}
          {sig && p.seal && <div className="absolute -top-2 right-2"><Seal seal={p.seal} size={118} pressed={justSigned === role} /></div>}
        </div>
      </div>
    );
  };
  return (
    <article className="contract-paper mx-auto max-w-[820px] rounded-2xl bg-white p-6 shadow-card ring-1 ring-cream-200 sm:p-10">
      <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand">AgroMarket</p>
          <h1 className="mt-1 text-lg font-extrabold leading-snug text-ink sm:text-xl">{c.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">№ {c.number} · {date(c.createdAt, lang)}</p>
        </div>
        {qrSrc && <img src={qrSrc} alt="QR" className="h-24 w-24 shrink-0 rounded-lg ring-1 ring-cream-200" />}
      </header>
      <div className="space-y-5">
        <Clause title={t('y.contract.c1')}>
          <p>{t('y.contract.subjectText')}</p>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full min-w-[480px] text-left text-[13px]">
              <thead className="border-b border-cream-300 text-xs text-muted">
                <tr><th className="py-1.5">#</th><th>{t('y.contract.name')}</th><th className="text-right">{t('y.contract.qty')}</th><th className="text-right">{t('y.contract.price')}</th><th className="text-right">{t('y.contract.sum')}</th></tr>
              </thead>
              <tbody>
                {tm.items.map((i, k) => (
                  <tr key={k} className="border-b border-cream-100">
                    <td className="py-1.5">{k + 1}</td>
                    <td>{i.name}</td>
                    <td className="text-right">{num(i.quantity)} {t(`units.${i.unit}` as TKey) !== `units.${i.unit}` ? t(`units.${i.unit}` as TKey) : i.unit}</td>
                    <td className="text-right">{money(i.price, lang, false)}</td>
                    <td className="text-right font-semibold">{money(i.total ?? i.quantity * i.price, lang, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4} className="pt-2 text-right font-bold">{t('y.contract.total')}:</td><td className="pt-2 text-right font-extrabold text-brand">{money(c.totalAmount, lang)}</td></tr></tfoot>
            </table>
          </div>
        </Clause>
        <Clause title={t('y.contract.c2')}>
          <p>{t('y.contract.priceText', { total: money(c.totalAmount, lang), pre: tm.prepaymentPercent })}</p>
          <p>{tm.paymentTerms}</p>
        </Clause>
        <Clause title={t('y.contract.c3')}>
          <p>{t('y.contract.deliveryAddress')}: <b>{tm.deliveryAddress}</b>. {t('y.contract.deliveryDate')}: <b>{tm.deliveryDate ? date(tm.deliveryDate, lang) : t('y.contract.deliveryNone')}</b>.</p>
          <p>{tm.deliveryTerms}</p>
        </Clause>
        <Clause title={t('y.contract.c4')}><p>{tm.qualityTerms}</p></Clause>
        <Clause title={t('y.contract.c5')}><p>{t('y.contract.penaltyText', { p: tm.penaltyPercentPerDay, max: tm.penaltyMaxPercent })}</p></Clause>
        <Clause title={t('y.contract.c6')}><p>{tm.disputeResolution}</p></Clause>
        <Clause title={t('y.contract.c7')}><p>{t('y.contract.forceText')}</p></Clause>
        <Clause title={t('y.contract.c8')}><p>{t('y.contract.finalText')}</p></Clause>
        {tm.extraTerms && <Clause title={t('y.contract.c9')}><p className="whitespace-pre-wrap">{tm.extraTerms}</p></Clause>}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{party('SELLER')}{party('BUYER')}</div>
      {c.contentHash && (
        <p className="mt-6 flex items-start gap-1.5 break-all font-mono text-[10.5px] text-muted"><Hash className="mt-0.5 h-3 w-3 shrink-0" />{t('y.contract.hash')}: {c.contentHash}</p>
      )}
    </article>
  );
}

// ───────── Shartnoma sahifasi ─────────
export function ContractDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['contracts', id], queryFn: () => api.get<Contract>(`/contracts/${id}`) });
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [reason, setReason] = useState('');
  const [justSigned, setJustSigned] = useState<string | null>(null);
  useEffect(() => {
    if (q.data && !terms) setTerms(q.data.terms);
  }, [q.data, terms]);
  const refresh = (c: Contract) => {
    qc.setQueryData(['contracts', id], c);
    void qc.invalidateQueries({ queryKey: ['contracts'], exact: false });
  };
  const save = useMutation({ mutationFn: () => api.patch<Contract>(`/contracts/${id}`, { terms: cleanTerms(terms!) }), onSuccess: (c) => { refresh(c); setEditing(false); toast(t('common.saved')); }, onError: (e) => toast(err(e), 'error') });
  const send = useMutation({ mutationFn: () => api.post<Contract>(`/contracts/${id}/send`), onSuccess: (c) => { refresh(c); toast(t('y.contract.sentOk')); }, onError: (e) => toast(err(e), 'error') });
  const sign = useMutation({
    mutationFn: () => api.post<Contract>(`/contracts/${id}/sign`, { password, agree: true }),
    onSuccess: (c) => {
      setSignOpen(false);
      setPassword('');
      setJustSigned(c.myRole);
      refresh(c);
      toast(t('y.contract.signedOk'));
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const reject = useMutation({ mutationFn: () => api.post<Contract>(`/contracts/${id}/reject`, { reason }), onSuccess: (c) => { setRejectOpen(false); refresh(c); }, onError: (e) => toast(err(e), 'error') });
  const cancel = useMutation({ mutationFn: () => api.post(`/contracts/${id}/cancel`), onSuccess: () => nav('/contracts'), onError: (e) => toast(err(e), 'error') });

  const c = q.data;
  if (q.isLoading || !c) return <Skeleton className="h-[70vh]" />;
  const mine = c.myRole === 'BUYER' || c.myRole === 'SELLER';
  const signedByMe = c.signatures.some((s) => s.userId === user?.id);
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/contracts" className="inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('y.contract.back')}</Link>
        <div className="flex flex-wrap items-center gap-2">
          <ContractStatus s={c.status} />
          {mine && ['draft', 'rejected'].includes(c.status) && !editing && <Button size="sm" variant="outline" onClick={() => { setTerms(c.terms); setEditing(true); }}><FilePen className="h-4 w-4" />{t('y.contract.edit')}</Button>}
          {mine && ['draft', 'rejected'].includes(c.status) && !editing && <Button size="sm" loading={send.isPending} onClick={() => send.mutate()}><Send className="h-4 w-4" />{t('y.contract.send')}</Button>}
          {mine && c.status === 'pending' && !signedByMe && <Button size="sm" onClick={() => setSignOpen(true)}><FileSignature className="h-4 w-4" />{t('y.contract.sign')}</Button>}
          {mine && c.status === 'pending' && <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}><XCircle className="h-4 w-4" />{t('y.contract.reject')}</Button>}
          {c.createdById === user?.id && !c.signatures.length && ['draft', 'pending', 'rejected'].includes(c.status) && <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => confirm(`${t('y.contract.cancel')}?`) && cancel.mutate()}>{t('y.contract.cancel')}</Button>}
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button>
        </div>
      </div>
      {c.status === 'rejected' && c.rejectedReason && <p className="no-print mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">✕ {c.rejectedReason}</p>}
      {editing && terms ? (
        <Card className="no-print mb-5 space-y-4 p-5">
          <TermsEditor value={terms} onChange={setTerms} />
          <div className="flex gap-2"><Button loading={save.isPending} onClick={() => save.mutate()}>{t('y.contract.save')}</Button><Button variant="outline" onClick={() => setEditing(false)}>{t('common.cancel')}</Button></div>
        </Card>
      ) : (
        <>
          <ContractDocument c={c} qrSrc={`/api/v1/contracts/${c.id}/qr.svg`} justSigned={justSigned} />
          <p className="no-print mx-auto mt-3 flex max-w-[820px] items-center gap-2 text-xs text-muted"><QrCode className="h-4 w-4" />{t('y.contract.qrHint')} — <a href={c.verifyUrl} className="text-brand underline" target="_blank" rel="noreferrer">{c.verifyUrl}</a></p>
        </>
      )}

      <Modal open={signOpen} onClose={() => setSignOpen(false)} title={t('y.contract.signTitle')} footer={<Button block loading={sign.isPending} disabled={!agree || !password} onClick={() => sign.mutate()}><FileSignature className="h-4 w-4" />{t('y.contract.sign')} · {money(c.totalAmount, lang)}</Button>}>
        <p className="text-sm text-ink-soft">{t('y.contract.signText')}</p>
        <div className="mt-4 space-y-3">
          <Field label={t('y.contract.password')}><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
          <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label={t('y.contract.agree')} />
        </div>
      </Modal>
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title={t('y.contract.reject')} footer={<Button block variant="danger" loading={reject.isPending} disabled={reason.trim().length < 3} onClick={() => reject.mutate()}>{t('y.contract.reject')}</Button>}>
        <Field label={t('y.contract.rejectReason')}><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

// ───────── Ommaviy tekshiruv (QR) ─────────
interface Verify {
  number: string;
  title: string;
  status: Status;
  totalAmount: string;
  createdAt: string;
  signedAt: string | null;
  contentHash: string | null;
  integrity: boolean | null;
  buyer: { name: string; company: string | null; phone: string | null; seal: SealData | null };
  seller: { name: string; farm: string | null; phone: string | null; seal: SealData | null };
  items: Item[];
  signatures: { role: string; sealCode: string; signedAt: string; valid: boolean }[];
}

export function ContractVerify() {
  const { publicId = '' } = useParams();
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['public', 'contract', publicId], queryFn: () => api.get<Verify>(`/contracts/verify/${publicId}`), retry: false });
  const v = q.data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-extrabold text-ink"><ShieldCheck className="h-7 w-7 text-brand" />{t('y.contract.verifyTitle')}</h1>
      {q.isLoading ? <Skeleton className="h-80" /> : q.isError || !v ? (
        <Card className="p-8"><Empty icon={<ShieldAlert className="h-8 w-8 text-danger" />} title={t('common.error')} /></Card>
      ) : (
        <div className="space-y-4">
          <div className={cx('flex items-start gap-3 rounded-2xl p-4 text-sm font-bold', v.integrity === true ? 'bg-brand-50 text-brand-800' : v.integrity === false ? 'bg-red-50 text-danger' : 'bg-sun-100 text-amber-800')}>
            {v.integrity === true ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <ShieldAlert className="h-6 w-6 shrink-0" />}
            <span>{v.integrity === true ? t('y.contract.valid') : v.integrity === false ? t('y.contract.invalid') : t('y.contract.notFinal')}</span>
          </div>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted">№ {v.number}</p>
                <p className="mt-1 font-extrabold text-ink">{v.title}</p>
                <p className="mt-1 text-xs text-muted">{date(v.createdAt, lang)}{v.signedAt ? ` · ✍ ${dateTime(v.signedAt, lang)}` : ''}</p>
              </div>
              <div className="text-right"><ContractStatus s={v.status} /><p className="mt-2 text-lg font-extrabold text-brand">{money(v.totalAmount, lang)}</p></div>
            </div>
            <ul className="mt-4 divide-y divide-cream-200 text-sm">
              {v.items.map((i, k) => <li key={k} className="flex justify-between py-1.5"><span>{i.name} · {num(i.quantity)} {i.unit}</span><b>{money(i.total ?? i.quantity * i.price, lang, false)}</b></li>)}
            </ul>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['SELLER', 'BUYER'] as const).map((role) => {
              const p = role === 'SELLER' ? v.seller : v.buyer;
              const sig = v.signatures.find((s) => s.role === role);
              return (
                <Card key={role} className="relative flex min-h-[160px] flex-col p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{role === 'SELLER' ? t('y.contract.seller') : t('y.contract.buyer')}</p>
                  <p className="font-extrabold">{role === 'SELLER' ? v.seller.farm ?? p.name : v.buyer.company ?? p.name}</p>
                  <p className="text-sm text-muted">{p.name} · {p.phone}</p>
                  {sig ? (
                    <p className={cx('mt-auto text-xs font-bold', sig.valid ? 'text-brand' : 'text-danger')}>{sig.valid ? '✓' : '✕'} {dateTime(sig.signedAt, lang)} · {sig.sealCode}</p>
                  ) : <p className="mt-auto text-xs text-muted">{t('y.contract.notSigned')}</p>}
                  {sig && p.seal && <div className="absolute right-2 top-2 opacity-90"><Seal seal={p.seal} size={96} /></div>}
                </Card>
              );
            })}
          </div>
          {v.contentHash && <p className="break-all font-mono text-[11px] text-muted">{t('y.contract.hash')}: {v.contentHash}</p>}
          <img src={`/api/v1/contracts/verify/${publicId}/qr.svg`} alt="QR" className="h-28 w-28 rounded-lg ring-1 ring-cream-200" />
        </div>
      )}
    </div>
  );
}
