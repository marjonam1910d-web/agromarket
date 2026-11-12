import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, FileText, Gavel, KeyRound, MessageCircle, Printer, ShieldAlert, ShieldCheck, Undo2, UserCog } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { cx, date, dateTime, money, phone } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, PasswordInput, Select, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { Seal, type SealData } from '@/components/Seal';
import { WriteToModal } from '@/pages/wallet/Wallet';
import { ContractStatus } from '@/pages/contracts/Contracts';

type SanctionKind = 'warning' | 'fine' | 'suspension' | 'correction';
export interface Sanction {
  id: string;
  number: string;
  kind: SanctionKind;
  amount: string | null;
  reason: string;
  status: 'active' | 'cancelled';
  details: { deadline?: string | null; basis?: string | null; changes?: Record<string, { from: unknown; to: unknown }>; cancelReason?: string };
  createdAt: string;
  complaintId: string | null;
  userId: string;
  seller?: { farmName: string } | null;
  user?: { fullName: string; phone: string | null } | null;
}

interface UserCard {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  locale: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  buyerProfile: { companyName: string | null; isWholesale: boolean } | null;
  sellerProfile: { id: string; farmName: string; slug: string; description: string | null; region: string; district: string; address: string; tin: string | null; verificationStatus: string; verifiedAt: string | null; ratingAvg: string; ratingCount: number; _count: { products: number; salesPoints: number; sellerOrders: number } } | null;
  seal: SealData | null;
  _count: { orders: number; reviews: number; complaints: number; complaintsAgainst: number; sessions: number };
  orders: { id: string; orderNumber: string; total: string; status: string; paymentStatus: string; createdAt: string }[];
  sellerOrders: { id: string; number: string; total: string; status: string; createdAt: string }[];
  contracts: { id: string; number: string; title: string; status: 'draft' | 'pending' | 'signed' | 'rejected' | 'cancelled'; totalAmount: string; createdAt: string }[];
  wallet: { available: string; pendingWithdrawals: string; totalEarned: string } | null;
  sanctions: Sanction[];
  applications: { id: string; number: string; kind: string; status: string; createdAt: string }[];
  staffOf: { id: string; role: string; status: string; seller: { farmName: string } }[];
  complaints: { id: string; subject: string; status: string; createdAt: string; reporterId: string }[];
}

const KIND_TONE: Record<SanctionKind, 'yellow' | 'red' | 'dark' | 'blue'> = { warning: 'yellow', fine: 'red', suspension: 'dark', correction: 'blue' };
export function SanctionBadge({ kind }: { kind: SanctionKind }) {
  const { t } = useI18n();
  return <Badge tone={KIND_TONE[kind]}>{t(`z.sanction.k_${kind}` as TKey)}</Badge>;
}

// ───────── Chora berish (jarima, ogohlantirish, to'xtatish) ─────────
export function IssueSanctionModal({ open, onClose, user, complaintId, onDone }: { open: boolean; onClose: () => void; user: { id: string; name: string }; complaintId?: string; onDone?: (s: Sanction) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [kind, setKind] = useState<'warning' | 'fine' | 'suspension'>('warning');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [basis, setBasis] = useState('');
  const [deadline, setDeadline] = useState('');
  const [resolve, setResolve] = useState(true);
  const m = useMutation({
    mutationFn: () => api.post<Sanction>('/backoffice/sanctions', { userId: user.id, kind, amount: kind === 'fine' ? Number(amount) : undefined, reason: reason.trim(), basis: basis.trim() || undefined, deadline: deadline || undefined, complaintId, resolveComplaint: resolve }),
    onSuccess: (s) => {
      toast(t('z.sanction.issued', { n: s.number }));
      void qc.invalidateQueries({ queryKey: ['admin'] });
      void qc.invalidateQueries({ queryKey: ['backoffice'] });
      onClose();
      onDone?.(s);
    },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Modal open={open} onClose={onClose} title={t('z.sanction.issue')} footer={<Button block variant={kind === 'warning' ? 'primary' : 'danger'} loading={m.isPending} disabled={reason.trim().length < 5 || (kind === 'fine' && Number(amount) < 1000)} onClick={() => m.mutate()}><Gavel className="h-4 w-4" />{t('z.sanction.issue')}</Button>}>
      <p className="mb-3 rounded-xl bg-cream-100 px-3 py-2 text-sm">{t('z.sanction.to')}: <b>{user.name}</b></p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(['warning', 'fine', 'suspension'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={cx('rounded-xl px-2 py-2.5 text-xs font-bold ring-2 transition', kind === k ? (k === 'warning' ? 'bg-sun-100 ring-amber-400' : k === 'fine' ? 'bg-red-50 text-danger ring-danger' : 'bg-ink text-white ring-ink') : 'bg-white ring-cream-200')}>{t(`z.sanction.k_${k}` as TKey)}</button>
        ))}
      </div>
      <p className="mb-3 text-xs text-muted">{t(`z.sanction.h_${kind}` as TKey)}</p>
      <div className="space-y-3">
        {kind === 'fine' && <Field label={t('z.sanction.amount')}><Input type="number" inputMode="numeric" min={1000} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
        <Field label={t('z.sanction.reason')}><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('z.sanction.reasonPh')} /></Field>
        <Field label={t('z.sanction.basis')}><Input value={basis} onChange={(e) => setBasis(e.target.value)} placeholder={t('z.sanction.basisPh')} /></Field>
        {kind === 'warning' && <Field label={t('z.sanction.deadline')}><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>}
        {complaintId && <Checkbox checked={resolve} onChange={(e) => setResolve(e.target.checked)} label={t('z.sanction.resolveComplaint')} />}
      </div>
    </Modal>
  );
}

// ───────── Chora hujjati (dalolatnoma / qaror) ─────────
export function SanctionDocModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['backoffice', 'sanction-doc', id], queryFn: () => api.get<Sanction & { user: { fullName: string; phone: string | null; email: string | null }; issuer: { fullName: string } | null; complaint: { subject: string; description: string; createdAt: string } | null; seller: { farmName: string; tin: string | null; address: string; region: string; district: string } | null; platformSeal: SealData }>(`/documents/sanction/${id}`) });
  const d = q.data;
  const { regionName } = useRegions();
  return (
    <Modal wide open onClose={onClose} title={d?.number ?? '…'} footer={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button>}>
      {!d ? <Skeleton className="h-96" /> : (
        <article className="print-doc relative rounded-xl bg-white p-5 text-[13.5px] leading-relaxed ring-1 ring-cream-200 sm:p-8">
          <header className="mb-5 border-b-2 border-ink pb-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand">AgroMarket</p>
            <h1 className="mt-1 text-lg font-extrabold uppercase text-ink">{t(`z.sanction.doc_${d.kind}` as TKey)}</h1>
            <p className="font-mono text-xs text-muted">№ {d.number} · {date(d.createdAt, lang)}</p>
          </header>
          {d.status === 'cancelled' && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-bold text-danger">{t('z.sanction.cancelled')}{d.details.cancelReason ? `: ${d.details.cancelReason}` : ''}</p>}
          <dl className="mb-4 grid gap-x-4 gap-y-1 sm:grid-cols-[180px_1fr]">
            <dt className="text-muted">{t('z.sanction.subject')}</dt>
            <dd className="font-semibold">{d.seller?.farmName ? `${d.seller.farmName} — ` : ''}{d.user.fullName}</dd>
            {d.seller?.tin && <><dt className="text-muted">{t('y.contract.tin')}</dt><dd>{d.seller.tin}</dd></>}
            {d.seller && <><dt className="text-muted">{t('z.app.f_address')}</dt><dd>{[regionName(d.seller.region), d.seller.district, d.seller.address].filter(Boolean).join(', ')}</dd></>}
            <dt className="text-muted">{t('common.phone')}</dt><dd>{phone(d.user.phone)}{d.user.email ? ` · ${d.user.email}` : ''}</dd>
          </dl>
          {d.complaint && (
            <section className="mb-4">
              <h3 className="font-bold">{t('z.sanction.basisComplaint')}</h3>
              <p className="text-ink-soft">«{d.complaint.subject}» ({date(d.complaint.createdAt, lang)}): {d.complaint.description}</p>
            </section>
          )}
          <section className="mb-4">
            <h3 className="font-bold">{t('z.sanction.reason')}</h3>
            <p className="whitespace-pre-wrap text-ink-soft">{d.reason}</p>
            {d.details.basis && <p className="mt-1 text-ink-soft">{t('z.sanction.basis')}: {d.details.basis}</p>}
          </section>
          {d.kind === 'correction' && d.details.changes && (
            <table className="mb-4 w-full text-left text-[12.5px]">
              <thead className="border-b border-cream-300 text-xs text-muted"><tr><th className="py-1">{t('z.sanction.field')}</th><th>{t('z.sanction.was')}</th><th>{t('z.sanction.now')}</th></tr></thead>
              <tbody>{Object.entries(d.details.changes).map(([k, v]) => <tr key={k} className="border-b border-cream-100"><td className="py-1 font-semibold">{t(`z.field.${k.replace('seller.', '')}` as TKey)}</td><td className="text-muted line-through">{String(v.from ?? '—')}</td><td className="font-semibold">{String(v.to ?? '—')}</td></tr>)}</tbody>
            </table>
          )}
          <section className="mb-6 rounded-xl bg-cream-50 p-3">
            <h3 className="font-bold">{t('z.sanction.decision')}</h3>
            <p>
              {d.kind === 'fine' && t('z.sanction.t_fine', { amount: money(d.amount, lang) })}
              {d.kind === 'warning' && t('z.sanction.t_warning', { deadline: d.details.deadline ? date(d.details.deadline, lang) : '—' })}
              {d.kind === 'suspension' && t('z.sanction.t_suspension')}
              {d.kind === 'correction' && t('z.sanction.t_correction')}
            </p>
            <p className="mt-1 text-xs text-muted">{t('z.sanction.appeal')}</p>
          </section>
          <footer className="flex items-end justify-between gap-4">
            <div className="text-xs">
              <p className="text-muted">{t('z.sanction.issuer')}</p>
              <p className="font-bold">{d.issuer?.fullName ?? '—'}</p>
              <p className="text-muted">{dateTime(d.createdAt, lang)}</p>
            </div>
            <Seal seal={d.platformSeal} size={120} />
          </footer>
        </article>
      )}
    </Modal>
  );
}

// ───────── Choralar ro'yxati ─────────
export function AdminSanctions() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [kind, setKind] = useState<SanctionKind | ''>('');
  const [doc, setDoc] = useState<string | null>(null);
  const [cancel, setCancel] = useState<Sanction | null>(null);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['backoffice', 'sanctions', kind], queryFn: () => api.get<Sanction[]>(`/backoffice/sanctions${kind ? `?kind=${kind}` : ''}`) });
  const c = useMutation({
    mutationFn: () => api.post(`/backoffice/sanctions/${cancel!.id}/cancel`, { reason }),
    onSuccess: () => { setCancel(null); setReason(''); void qc.invalidateQueries({ queryKey: ['backoffice'] }); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div>
      <PageHeader title={t('z.nav.sanctions')} subtitle={t('z.sanction.subtitle')} />
      <Tabs className="mb-4" value={kind || 'all'} onChange={(v) => setKind(v === 'all' ? '' : (v as SanctionKind))} items={[{ value: 'all', label: t('y.users.all') }, ...(['warning', 'fine', 'suspension', 'correction'] as const).map((k) => ({ value: k, label: t(`z.sanction.k_${k}` as TKey) }))]} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.length ? <Card className="p-8"><Empty icon={<Gavel className="h-8 w-8" />} title={t('z.sanction.empty')} hint={t('z.sanction.emptyHint')} /></Card> : (
        <div className="space-y-2.5">
          {q.data.map((s) => (
            <Card key={s.id} className={cx('flex flex-wrap items-center gap-3 p-4', s.status === 'cancelled' && 'opacity-60')}>
              <SanctionBadge kind={s.kind} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink"><Link to={`/admin/users/${s.userId}`} className="hover:underline">{s.seller?.farmName ?? s.user?.fullName}</Link> <span className="font-mono text-xs text-muted">№ {s.number}</span></p>
                <p className="line-clamp-1 text-sm text-ink-soft">{s.reason}</p>
                <p className="text-xs text-muted">{dateTime(s.createdAt, lang)}{s.status === 'cancelled' ? ` · ${t('z.sanction.cancelled')}` : ''}</p>
              </div>
              {s.amount && <p className="font-extrabold text-danger">−{money(s.amount, lang)}</p>}
              <Button size="sm" variant="outline" onClick={() => setDoc(s.id)}><FileText className="h-4 w-4" />{t('z.sanction.doc')}</Button>
              {s.status === 'active' && s.kind !== 'correction' && <Button size="sm" variant="ghost" onClick={() => setCancel(s)}><Undo2 className="h-4 w-4" />{t('z.sanction.cancel')}</Button>}
            </Card>
          ))}
        </div>
      )}
      {doc && <SanctionDocModal id={doc} onClose={() => setDoc(null)} />}
      <Modal open={!!cancel} onClose={() => setCancel(null)} title={t('z.sanction.cancel')} footer={<Button block loading={c.isPending} disabled={reason.trim().length < 3} onClick={() => c.mutate()}>{t('z.sanction.cancel')}</Button>}>
        <p className="mb-2 text-sm text-ink-soft">{t('z.sanction.cancelText')}</p>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('common.reason')} />
      </Modal>
    </div>
  );
}

// ───────── Foydalanuvchi kartasi ─────────
function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-cream-100 py-2 text-sm last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right font-semibold text-ink">{v}</span>
    </div>
  );
}

type Tab = 'info' | 'edit' | 'orders' | 'contracts' | 'wallet' | 'docs';

export function AdminUserDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'info';
  const { regions, regionName } = useRegions();
  const q = useQuery({ queryKey: ['backoffice', 'user', id], queryFn: () => api.get<UserCard>(`/backoffice/users/${id}`) });
  const u = q.data;
  const [form, setForm] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [write, setWrite] = useState(false);
  const [sanction, setSanction] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  useEffect(() => {
    if (!u) return;
    setForm({
      fullName: u.fullName, email: u.email ?? '', phone: u.phone ?? '', locale: u.locale, companyName: u.buyerProfile?.companyName ?? '',
      farmName: u.sellerProfile?.farmName ?? '', description: u.sellerProfile?.description ?? '', region: u.sellerProfile?.region ?? '', district: u.sellerProfile?.district ?? '', address: u.sellerProfile?.address ?? '', tin: u.sellerProfile?.tin ?? '',
    });
  }, [u]);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['backoffice', 'user', id] });
  const save = useMutation({
    mutationFn: () => api.patch<{ changed: number; act?: string; sanctionId?: string }>(`/backoffice/users/${id}`, {
      fullName: form.fullName, email: form.email || null, phone: form.phone || null, locale: form.locale,
      ...(u?.buyerProfile ? { companyName: form.companyName || null } : {}),
      ...(u?.sellerProfile ? { seller: { farmName: form.farmName, description: form.description || null, region: form.region, district: form.district, address: form.address, tin: form.tin || null } } : {}),
      reason: reason || undefined,
    }),
    onSuccess: (r) => {
      toast(r.changed ? t('z.user.saved', { n: r.act ?? '' }) : t('z.user.noChanges'));
      setReason('');
      refresh();
      if (r.sanctionId) setDoc(r.sanctionId);
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const pass = useMutation({ mutationFn: () => api.post(`/backoffice/users/${id}/password`, { password: pw }), onSuccess: () => { setPwOpen(false); setPw(''); toast(t('z.user.pwDone')); }, onError: (e) => toast(err(e), 'error') });
  const block = useMutation({ mutationFn: (status: 'ACTIVE' | 'BLOCKED') => api.patch(`/admin/users/${id}/status`, { status }), onSuccess: refresh, onError: (e) => toast(err(e), 'error') });

  if (q.isError) return <Card className="p-8"><Empty title={t('common.error')} /></Card>;
  if (!u) return <Skeleton className="h-[60vh]" />;
  const sp_ = u.sellerProfile;
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const districts = regions.find((r) => r.code === form.region)?.districts ?? [];
  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'info', label: t('z.user.t_info') },
    { value: 'edit', label: t('z.user.t_edit') },
    { value: 'orders', label: t('admin.orders'), count: u.orders.length + u.sellerOrders.length },
    { value: 'contracts', label: t('y.nav.contracts'), count: u.contracts.length },
    ...(u.wallet ? [{ value: 'wallet' as Tab, label: t('y.nav.wallet') }] : []),
    { value: 'docs', label: t('z.user.t_docs'), count: u.sanctions.length + u.applications.length },
  ];
  return (
    <div>
      <button type="button" onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('admin.users')}</button>
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 bg-gradient-to-r from-brand-800 to-brand-700 p-5 text-white">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold">{u.fullName.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold">{sp_?.farmName ?? u.fullName}</h1>
            {sp_ && <p className="text-sm text-white/80">{u.fullName}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="lime">{t(`z.role.${u.role}` as TKey)}</Badge>
              <Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{t(`z.ustatus.${u.status}` as TKey)}</Badge>
              {sp_ && <StatusBadge status={sp_.verificationStatus} kind="ver" />}
              {u.buyerProfile?.isWholesale && <Badge tone="yellow">{t('y.users.wholesale')}</Badge>}
              {u.staffOf.map((s) => <Badge key={s.id} tone="blue">{t(`z.staff.r_${s.role}` as TKey)} · {s.seller.farmName}</Badge>)}
            </div>
          </div>
          {u.role !== 'ADMIN' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="light" onClick={() => setWrite(true)}><MessageCircle className="h-4 w-4" />{t('y.support.writeUser')}</Button>
              <Button size="sm" variant="light" onClick={() => setPwOpen(true)}><KeyRound className="h-4 w-4" />{t('z.user.password')}</Button>
              <Button size="sm" variant="light" onClick={() => setSanction(true)}><Gavel className="h-4 w-4" />{t('z.sanction.issue')}</Button>
              {u.status === 'ACTIVE' ? (
                <Button size="sm" variant="light" loading={block.isPending} onClick={() => confirm(t('admin.block') + '?') && block.mutate('BLOCKED')}><Ban className="h-4 w-4" />{t('admin.block')}</Button>
              ) : (
                <Button size="sm" variant="light" loading={block.isPending} onClick={() => block.mutate('ACTIVE')}><CheckCircle2 className="h-4 w-4" />{t('admin.unblock')}</Button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-cream-100 text-center sm:grid-cols-5 sm:divide-y-0">
          {[
            [t('admin.orders'), u._count.orders + (sp_?._count.sellerOrders ?? 0)],
            [t('y.nav.contracts'), u.contracts.length],
            [t('admin.complaints'), `${u._count.complaints} / ${u._count.complaintsAgainst}`],
            [t('z.nav.sanctions'), u.sanctions.filter((s) => s.status === 'active' && s.kind !== 'correction').length],
            [t('z.user.sessions'), u._count.sessions],
          ].map(([k, v]) => (
            <div key={String(k)} className="px-3 py-3"><p className="text-lg font-extrabold text-ink">{v}</p><p className="text-[11px] font-semibold text-muted">{k}</p></div>
          ))}
        </div>
      </Card>

      <Tabs className="mb-4" value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} items={tabs} />

      {tab === 'info' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-2 font-extrabold">{t('z.user.contacts')}</h2>
            <Row k={t('common.phone')} v={<>{phone(u.phone) || '—'} {u.phoneVerifiedAt && <ShieldCheck className="inline h-4 w-4 text-brand" />}</>} />
            <Row k="Email" v={<>{u.email ?? '—'} {u.emailVerifiedAt && <ShieldCheck className="inline h-4 w-4 text-brand" />}</>} />
            <Row k={t('x.settings.language')} v={u.locale.toUpperCase()} />
            <Row k={t('admin.joined')} v={dateTime(u.createdAt, lang)} />
            <Row k={t('z.user.lastLogin')} v={u.lastLoginAt ? dateTime(u.lastLoginAt, lang) : '—'} />
            {u.buyerProfile?.companyName && <Row k={t('z.field.companyName')} v={u.buyerProfile.companyName} />}
          </Card>
          {sp_ && (
            <Card className="p-5">
              <h2 className="mb-2 font-extrabold">{t('z.user.farm')}</h2>
              <Row k={t('y.contract.tin')} v={sp_.tin ?? '—'} />
              <Row k={t('z.app.f_address')} v={[regionName(sp_.region), sp_.district, sp_.address].filter(Boolean).join(', ')} />
              <Row k={t('admin.products')} v={sp_._count.products} />
              <Row k={t('y.nav.points')} v={sp_._count.salesPoints} />
              <Row k="★" v={`${Number(sp_.ratingAvg).toFixed(1)} (${sp_.ratingCount})`} />
              <Row k={t('z.user.verifiedAt')} v={sp_.verifiedAt ? date(sp_.verifiedAt, lang) : '—'} />
              <Link to={`/farmers/${sp_.slug}`} className="mt-2 inline-block text-sm font-bold text-brand">{t('y.map.openFarm')} →</Link>
            </Card>
          )}
          {u.seal && (
            <Card className="flex items-center gap-4 p-5">
              <Seal seal={u.seal} size={110} />
              <div><p className="text-xs text-muted">{t('y.seal.code')}</p><p className="font-mono font-extrabold">{u.seal.code}</p></div>
            </Card>
          )}
          {u.complaints.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 font-extrabold">{t('admin.complaints')}</h2>
              <ul className="divide-y divide-cream-100 text-sm">
                {u.complaints.map((c) => <li key={c.id} className="flex items-center justify-between gap-2 py-2"><span className="min-w-0 truncate">{c.reporterId === u.id ? '→ ' : '← '}{c.subject}</span><StatusBadge status={c.status} kind="c" /></li>)}
              </ul>
              <Link to="/admin/complaints" className="mt-2 inline-block text-sm font-bold text-brand">{t('admin.complaints')} →</Link>
            </Card>
          )}
        </div>
      )}

      {tab === 'edit' && (
        <Card className="max-w-3xl space-y-4 p-5">
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900"><UserCog className="mt-0.5 h-4 w-4 shrink-0" />{t('z.user.editHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('z.field.fullName')}><Input value={form.fullName ?? ''} onChange={set('fullName')} /></Field>
            <Field label={t('common.phone')} hint="+998901234567"><Input value={form.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label="Email"><Input type="email" value={form.email ?? ''} onChange={set('email')} /></Field>
            <Field label={t('x.settings.language')}><Select value={form.locale ?? 'uz'} onChange={set('locale')}>{['uz', 'ru', 'en'].map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</Select></Field>
            {u.buyerProfile && <Field label={t('z.field.companyName')}><Input value={form.companyName ?? ''} onChange={set('companyName')} /></Field>}
          </div>
          {sp_ && (
            <>
              <h3 className="pt-2 font-extrabold">{t('z.user.farm')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('z.field.farmName')}><Input value={form.farmName ?? ''} onChange={set('farmName')} /></Field>
                <Field label={t('y.contract.tin')}><Input inputMode="numeric" maxLength={9} value={form.tin ?? ''} onChange={set('tin')} /></Field>
                <Field label={t('z.field.region')}><Select value={form.region ?? ''} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value, district: '' }))}>{regions.map((r) => <option key={r.code} value={r.code}>{r[lang]}</option>)}</Select></Field>
                <Field label={t('z.field.district')}><Select value={form.district ?? ''} onChange={set('district')}><option value="">—</option>{districts.map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
                <Field label={t('z.field.address')} className="sm:col-span-2"><Input value={form.address ?? ''} onChange={set('address')} /></Field>
                <Field label={t('z.field.description')} className="sm:col-span-2"><Textarea rows={3} value={form.description ?? ''} onChange={set('description')} /></Field>
              </div>
            </>
          )}
          <Field label={t('z.user.reason')}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('z.user.reasonPh')} /></Field>
          <Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>
        </Card>
      )}

      {tab === 'orders' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-2 font-extrabold">{t('z.user.asBuyer')}</h2>
            {!u.orders.length ? <Empty title={t('common.empty')} /> : <ul className="divide-y divide-cream-100 text-sm">{u.orders.map((o) => <li key={o.id} className="flex items-center justify-between gap-2 py-2"><Link to={`/account/orders/${o.id}`} className="font-mono font-bold text-brand">{o.orderNumber}</Link><span className="text-muted">{date(o.createdAt, lang)}</span><b>{money(o.total, lang)}</b><StatusBadge status={o.status} /></li>)}</ul>}
          </Card>
          {sp_ && (
            <Card className="p-4">
              <h2 className="mb-2 font-extrabold">{t('z.user.asSeller')}</h2>
              {!u.sellerOrders.length ? <Empty title={t('common.empty')} /> : <ul className="divide-y divide-cream-100 text-sm">{u.sellerOrders.map((o) => <li key={o.id} className="flex items-center justify-between gap-2 py-2"><span className="font-mono font-bold">{o.number}</span><span className="text-muted">{date(o.createdAt, lang)}</span><b>{money(o.total, lang)}</b><StatusBadge status={o.status} /></li>)}</ul>}
            </Card>
          )}
        </div>
      )}

      {tab === 'contracts' && (
        <Card className="p-4">
          {!u.contracts.length ? <Empty title={t('y.contract.empty')} /> : (
            <ul className="divide-y divide-cream-100">
              {u.contracts.map((c) => (
                <li key={c.id}><Link to={`/contracts/${c.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-cream-50"><span className="font-mono text-xs text-muted">№ {c.number}</span><span className="min-w-0 flex-1 truncate font-bold">{c.title}</span><b className="text-brand">{money(c.totalAmount, lang)}</b><ContractStatus s={c.status} /></Link></li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'wallet' && u.wallet && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[[t('y.wallet.available'), u.wallet.available], [t('y.wallet.pending'), u.wallet.pendingWithdrawals], [t('y.wallet.earned'), u.wallet.totalEarned]].map(([k, v]) => (
            <Card key={k} className="p-4"><p className="text-xs font-semibold text-muted">{k}</p><p className="text-xl font-extrabold">{money(v, lang)}</p></Card>
          ))}
          <Link to="/admin/wallet" className="text-sm font-bold text-brand sm:col-span-3">{t('y.wallet.adminTitle')} →</Link>
        </div>
      )}

      {tab === 'docs' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 font-extrabold"><ShieldAlert className="h-4 w-4 text-danger" />{t('z.nav.sanctions')}</h2>
            {!u.sanctions.length ? <Empty title={t('z.sanction.empty')} /> : (
              <ul className="divide-y divide-cream-100 text-sm">
                {u.sanctions.map((s) => (
                  <li key={s.id} className={cx('flex flex-wrap items-center gap-2 py-2', s.status === 'cancelled' && 'opacity-50')}>
                    <SanctionBadge kind={s.kind} />
                    <span className="min-w-0 flex-1 truncate">{s.reason}</span>
                    {s.amount && <b className="text-danger">−{money(s.amount, lang)}</b>}
                    <button type="button" onClick={() => setDoc(s.id)} className="text-xs font-bold text-brand">{s.number}</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 font-extrabold">{t('z.nav.applications')}</h2>
            {!u.applications.length ? <Empty title={t('common.empty')} /> : (
              <ul className="divide-y divide-cream-100 text-sm">
                {u.applications.map((a) => <li key={a.id}><Link to={`/admin/applications/${a.id}`} className="flex items-center gap-2 py-2"><span className="font-mono text-xs">{a.number}</span><span className="flex-1">{t(`z.app.k_${a.kind}` as TKey)}</span><span className="text-xs text-muted">{date(a.createdAt, lang)}</span><Badge tone={a.status === 'approved' ? 'green' : a.status === 'pending' ? 'yellow' : a.status === 'rejected' ? 'red' : 'gray'}>{t(`z.app.s_${a.status}` as TKey)}</Badge></Link></li>)}
              </ul>
            )}
          </Card>
        </div>
      )}

      <WriteToModal open={write} onClose={() => setWrite(false)} name={sp_?.farmName ?? u.fullName} endpoint={`/conversations/admin/${u.id}`} />
      <IssueSanctionModal open={sanction} onClose={() => setSanction(false)} user={{ id: u.id, name: sp_?.farmName ?? u.fullName }} onDone={(s) => { refresh(); setDoc(s.id); }} />
      {doc && <SanctionDocModal id={doc} onClose={() => setDoc(null)} />}
      <Modal open={pwOpen} onClose={() => setPwOpen(false)} title={t('z.user.password')} footer={<Button block loading={pass.isPending} disabled={pw.length < 8} onClick={() => pass.mutate()}><KeyRound className="h-4 w-4" />{t('common.save')}</Button>}>
        <p className="mb-3 text-sm text-ink-soft">{t('z.user.pwText')}</p>
        <Field label={t('z.user.newPassword')} hint={t('z.user.pwHint')}><PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
      </Modal>
    </div>
  );
}
