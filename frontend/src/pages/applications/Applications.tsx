import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCircle2, FileCheck2, FilePlus2, FileText, FileUp, Handshake, Hash, Package, Paperclip, Plus, Printer, Sparkles, Store, Trash2, X, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { catName, cx, date, dateTime, money } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, PasswordInput, Select, Skeleton, Tabs, Textarea } from '@/components/ui';
import { ImageUploader, PageHeader, StatusBadge } from '@/components/common';
import { Seal, type SealData } from '@/components/Seal';

type Kind = 'SELLER' | 'PRODUCTS' | 'PARTNERSHIP';
type Status = 'pending' | 'approved' | 'partially_approved' | 'rejected' | 'withdrawn';
interface Attachment { key: string; name: string; type: 'certificate' | 'license' | 'passport' | 'farm_registry' | 'land' | 'other' }
interface SellerData { fullName: string; position: string; phone: string; email: string | null; legalForm: 'fermer' | 'dehqon' | 'mchj' | 'yatt' | 'kooperativ'; farmName: string; tin: string; regNumber: string; regDate: string; region: string; district: string; address: string; landArea: number | string; employees: number | string; activity: string[]; extra: string }
interface ProductSnap { id: string; name: string; price: string; unit: string; categoryId: string; description: string }
interface AppItem { id: string; productId: string | null; status: 'pending' | 'approved' | 'rejected'; note: string | null; product: { id: string; name: string; slug: string; description: string; price: string; unit: string; minOrderQty: string; isOrganic: boolean; status: string; rejectionReason: string | null; category: { id: string; nameUz: string; nameRu: string; nameEn: string; isActive: boolean; proposedById: string | null }; images: { url: string; thumbUrl: string | null }[]; inventory: { quantity: string } | null } | null }
export interface Application {
  id: string;
  number: string;
  kind: Kind;
  status: Status;
  data: Record<string, unknown>;
  attachments: Attachment[];
  sealCode: string | null;
  contentHash: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  items: AppItem[];
  seal?: SealData | null;
  seller: { id: string; farmName: string; slug: string; region: string; district: string; address: string; tin: string | null; verificationStatus: string; user: { fullName: string; phone: string | null; email: string | null } };
  partnership?: { number: string; deliverySharePercent: string; status: string } | null;
  _count?: { items: number };
}

const STATUS_TONE: Record<Status, 'yellow' | 'green' | 'blue' | 'red' | 'gray'> = { pending: 'yellow', approved: 'green', partially_approved: 'blue', rejected: 'red', withdrawn: 'gray' };
const KIND_ICON: Record<Kind, typeof Store> = { SELLER: Store, PRODUCTS: Package, PARTNERSHIP: Handshake };
export function AppStatus({ s }: { s: Status }) {
  const { t } = useI18n();
  return <Badge tone={STATUS_TONE[s]}>{t(`z.app.s_${s}` as TKey)}</Badge>;
}

// ───────── Ariza hujjati (davlat namunasidagi ko'rinish) ─────────
function DocRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <tr className="border-b border-cream-100 align-top">
      <td className="w-[42%] py-1.5 pr-3 text-ink-soft">{k}</td>
      <td className="py-1.5 font-semibold text-ink">{v || '—'}</td>
    </tr>
  );
}

export function ApplicationDocument({ a, preview }: { a: Pick<Application, 'number' | 'kind' | 'data' | 'attachments' | 'createdAt' | 'contentHash' | 'status' | 'reviewNote' | 'reviewedAt' | 'items' | 'seller'> & { seal?: SealData | null; partnership?: Application['partnership'] }; preview?: boolean }) {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const d = a.data as Partial<SellerData> & { note?: string; products?: ProductSnap[]; couriers?: number; vehicles?: string; regions?: string[]; proposedPercent?: number };
  const applicant = d.fullName ?? a.seller.user.fullName;
  const farm = d.farmName ?? a.seller.farmName;
  const attachLink = (k: string) => `/api/v1/uploads/private?key=${encodeURIComponent(k)}`;
  return (
    <article className="print-doc relative mx-auto max-w-[800px] rounded-2xl bg-white p-6 text-[13.5px] leading-relaxed shadow-card ring-1 ring-cream-200 sm:p-10">
      {/* rekvizitlar: kimga / kimdan — davlat ariza namunasidagidek o'ng tomonda */}
      <div className="ml-auto max-w-[340px] text-right text-[13px] leading-snug">
        <p className="font-bold">{t('z.app.to')}</p>
        <p className="mt-2">{t('z.app.from', { farm, position: d.position ?? t('z.app.head') })}</p>
        <p className="font-bold">{applicant}</p>
        <p className="text-ink-soft">{[regionName(d.region ?? a.seller.region), d.district ?? a.seller.district, d.address ?? a.seller.address].filter(Boolean).join(', ')}</p>
        <p className="text-ink-soft">{t('common.phone')}: {d.phone ?? a.seller.user.phone ?? '—'}</p>
      </div>
      <h1 className="my-6 text-center text-xl font-extrabold uppercase tracking-[0.3em] text-ink">{t('z.app.ariza')}</h1>
      <p className="mb-1 text-center font-mono text-xs text-muted">№ {a.number} · {date(a.createdAt, lang)}</p>
      <p className="mb-4 indent-8">{t(`z.app.body_${a.kind}` as TKey, { farm, n: a.items.length, percent: d.proposedPercent ?? '—' })}</p>

      {a.kind === 'SELLER' && (
        <table className="mb-4 w-full text-left">
          <tbody>
            <DocRow k={t('z.app.f_legalForm')} v={d.legalForm ? t(`z.app.lf_${d.legalForm}` as TKey) : ''} />
            <DocRow k={t('z.app.f_farmName')} v={farm} />
            <DocRow k={t('y.contract.tin')} v={d.tin} />
            <DocRow k={t('z.app.f_regNumber')} v={`${d.regNumber ?? '—'}${d.regDate ? ` · ${date(d.regDate, lang)}` : ''}`} />
            <DocRow k={t('z.app.f_address')} v={[regionName(d.region), d.district, d.address].filter(Boolean).join(', ')} />
            <DocRow k={t('z.app.f_landArea')} v={d.landArea !== undefined ? `${d.landArea} ${t('z.app.ha')}` : ''} />
            <DocRow k={t('z.app.f_employees')} v={d.employees} />
            <DocRow k={t('z.app.f_activity')} v={(d.activity ?? []).join(', ')} />
            <DocRow k={t('z.app.f_contact')} v={[d.phone, d.email].filter(Boolean).join(' · ')} />
            {d.extra ? <DocRow k={t('z.app.f_extra')} v={d.extra} /> : null}
          </tbody>
        </table>
      )}

      {a.kind === 'PRODUCTS' && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="border-b-2 border-cream-300 text-[11px] uppercase text-muted"><tr><th className="py-1.5">#</th><th>{t('y.contract.name')}</th><th>{t('admin.categories')}</th><th className="text-right">{t('y.contract.price')}</th><th>{t('z.app.decision')}</th></tr></thead>
            <tbody>
              {(a.items.length ? a.items.map((i) => ({ id: i.id, name: i.product?.name ?? '—', cat: i.product ? catName(i.product.category, lang) : '', price: i.product?.price ?? '0', unit: i.product?.unit ?? '', st: i.status, note: i.note })) : (d.products ?? []).map((p) => ({ id: p.id, name: p.name, cat: '', price: p.price, unit: p.unit, st: 'pending' as const, note: null }))).map((r, k) => (
                <tr key={r.id} className="border-b border-cream-100">
                  <td className="py-1.5">{k + 1}</td>
                  <td className="font-semibold">{r.name}</td>
                  <td>{r.cat}</td>
                  <td className="text-right">{money(r.price, lang, false)} / {t(`units.${r.unit}` as TKey)}</td>
                  <td>{r.st === 'approved' ? <span className="font-bold text-brand">✓ {t('z.app.itemOk')}</span> : r.st === 'rejected' ? <span className="font-bold text-danger">✕ {r.note ?? t('z.app.itemNo')}</span> : <span className="text-muted">…</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.note && <p className="mt-2 text-ink-soft">{t('z.app.note')}: {d.note}</p>}
        </div>
      )}

      {a.kind === 'PARTNERSHIP' && (
        <table className="mb-4 w-full text-left">
          <tbody>
            <DocRow k={t('z.app.f_couriers')} v={d.couriers} />
            <DocRow k={t('z.app.f_vehicles')} v={d.vehicles} />
            <DocRow k={t('z.app.f_regions')} v={(d.regions ?? []).map((r) => regionName(r)).join(', ')} />
            <DocRow k={t('z.app.f_share')} v={`${a.partnership ? Number(a.partnership.deliverySharePercent) : d.proposedPercent}%`} />
            {d.note ? <DocRow k={t('z.app.note')} v={d.note} /> : null}
          </tbody>
        </table>
      )}

      {a.attachments.length > 0 && (
        <section className="mb-4">
          <p className="font-bold">{t('z.app.annex')}:</p>
          <ol className="list-decimal pl-6">
            {a.attachments.map((x) => (
              <li key={x.key}>{preview ? x.name : <a href={attachLink(x.key)} target="_blank" rel="noreferrer" className="text-brand underline">{x.name}</a>} <span className="text-xs text-muted">({t(`z.app.at_${x.type}` as TKey)})</span></li>
            ))}
          </ol>
        </section>
      )}
      <p className="mb-6 text-ink-soft">{t('z.app.confirm')}</p>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">{t('z.app.signed')}</p>
          <p className="font-bold">{applicant}</p>
          <p className="text-xs text-muted">{dateTime(a.createdAt, lang)}</p>
        </div>
        {a.seal ? <Seal seal={a.seal} size={118} /> : preview ? <span className="rounded-full border-2 border-dashed border-cream-300 px-6 py-8 text-xs text-muted">{t('z.app.sealHere')}</span> : null}
      </div>
      {a.contentHash && <p className="mt-5 flex items-start gap-1 break-all font-mono text-[10.5px] text-muted"><Hash className="mt-0.5 h-3 w-3 shrink-0" />SHA-256: {a.contentHash}</p>}
      {a.reviewedAt && (
        <div className={cx('mt-6 rounded-xl border-2 p-3', a.status === 'rejected' ? 'border-danger/40 bg-red-50' : 'border-brand/40 bg-brand-50')}>
          <p className="text-xs font-bold uppercase tracking-wider">{t('z.app.resolution')}</p>
          <p className="font-extrabold">{t(`z.app.s_${a.status}` as TKey)} · {dateTime(a.reviewedAt, lang)}</p>
          {a.reviewNote && <p className="text-sm">{a.reviewNote}</p>}
          {a.partnership && <p className="text-sm">{t('z.staff.partnership')}: № {a.partnership.number}</p>}
        </div>
      )}
    </article>
  );
}

// ───────── Fermer: arizalar ro'yxati ─────────
interface Template { seller: { fullName: string; phone: string | null; email: string | null; farmName: string; tin: string | null; region: string; district: string; address: string; verificationStatus: string }; categories: { id: string; slug: string; nameUz: string; nameRu: string; nameEn: string; parentId: string | null; isActive: boolean }[]; partnership: { number: string } | null; partnerSharePercent: number; pending: { id: string; kind: Kind; number: string } | null }
const useTemplate = () => useQuery({ queryKey: ['applications', 'template'], queryFn: () => api.get<Template>('/applications/template') });

export function SellerApplications() {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['applications', 'mine'], queryFn: () => api.get<Application[]>('/applications/mine') });
  const tpl = useTemplate();
  const verified = tpl.data?.seller.verificationStatus === 'APPROVED';
  const cards: { kind: Kind; to: string; disabled?: boolean; hint?: string }[] = [
    { kind: 'SELLER', to: '/seller/applications/new/seller', disabled: verified, hint: verified ? t('z.app.alreadyVerified') : undefined },
    { kind: 'PRODUCTS', to: '/seller/applications/new/products', disabled: !verified, hint: !verified ? t('z.app.needVerified') : undefined },
    { kind: 'PARTNERSHIP', to: '/seller/applications/new/partnership', disabled: !verified || !!tpl.data?.partnership, hint: tpl.data?.partnership ? t('z.app.partnerActive', { n: tpl.data.partnership.number }) : !verified ? t('z.app.needVerified') : undefined },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title={t('z.nav.applications')} subtitle={t('z.app.subtitle')} />
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = KIND_ICON[c.kind];
          const body = (
            <div className={cx('flex h-full flex-col gap-2 rounded-2xl bg-white p-4 ring-1 transition', c.disabled ? 'opacity-60 ring-cream-200' : 'ring-cream-200 hover:-translate-y-0.5 hover:shadow-card hover:ring-brand/40')}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon className="h-5 w-5" /></span>
              <b className="text-ink">{t(`z.app.k_${c.kind}` as TKey)}</b>
              <span className="text-xs leading-snug text-muted">{c.hint ?? t(`z.app.d_${c.kind}` as TKey)}</span>
              {!c.disabled && <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-brand"><FilePlus2 className="h-4 w-4" />{t('z.app.fill')}</span>}
            </div>
          );
          return c.disabled ? <div key={c.kind}>{body}</div> : <Link key={c.kind} to={c.to}>{body}</Link>;
        })}
      </div>
      <h2 className="pt-2 font-extrabold">{t('z.app.history')}</h2>
      {q.isLoading ? <Skeleton className="h-32" /> : !q.data?.length ? <Card className="p-8"><Empty icon={<FileText className="h-8 w-8" />} title={t('z.app.empty')} /></Card> : (
        <div className="space-y-2.5">
          {q.data.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <Link key={a.id} to={`/seller/applications/${a.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-cream-200 hover:ring-brand/40">
                <Icon className="h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t(`z.app.k_${a.kind}` as TKey)}{a.kind === 'PRODUCTS' ? ` · ${a.items.length}` : ''}</p>
                  <p className="text-xs text-muted">№ {a.number} · {date(a.createdAt, lang)}</p>
                </div>
                <AppStatus s={a.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SellerApplicationView() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['applications', id], queryFn: () => api.get<Application>(`/applications/${id}`) });
  const w = useMutation({ mutationFn: () => api.post(`/applications/${id}/withdraw`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['applications'] }); toast(t('z.app.withdrawn')); }, onError: (e) => toast(err(e), 'error') });
  if (!q.data) return <Skeleton className="h-[70vh]" />;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/seller/applications" className="inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('z.nav.applications')}</Link>
        <div className="flex gap-2">
          <AppStatus s={q.data.status} />
          {q.data.status === 'pending' && <Button size="sm" variant="ghost" loading={w.isPending} onClick={() => confirm(t('z.app.withdrawQ')) && w.mutate()}>{t('z.app.withdraw')}</Button>}
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button>
        </div>
      </div>
      <ApplicationDocument a={q.data} />
    </div>
  );
}

// ───────── Yangi ariza ─────────
function SignBox({ password, setPassword, agree, setAgree, onSubmit, loading, disabled }: { password: string; setPassword: (v: string) => void; agree: boolean; setAgree: (v: boolean) => void; onSubmit: () => void; loading: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <Card className="space-y-3 border-2 border-brand/30 p-4">
      <p className="flex items-center gap-2 font-extrabold"><FileCheck2 className="h-5 w-5 text-brand" />{t('z.app.signTitle')}</p>
      <p className="text-xs text-muted">{t('z.app.signText')}</p>
      <Field label={t('y.contract.password')}><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
      <Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} label={t('z.app.agree')} />
      <Button block size="lg" loading={loading} disabled={disabled || !agree || !password} onClick={onSubmit}><FileCheck2 className="h-4 w-4" />{t('z.app.submit')}</Button>
    </Card>
  );
}

const ACTIVITIES = ['Sabzavotlar', 'Mevalar', 'Poliz ekinlari', "Don va dukkaklilar", 'Sut mahsulotlari', "Go'sht", 'Parrandachilik', 'Asalarichilik', 'Issiqxona', "Ko'chat va urug'", 'Quritilgan mahsulotlar', 'Baliqchilik'];

function SellerForm() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tpl = useTemplate();
  const { user } = useAuth();
  const { regions } = useRegions();
  const [d, setD] = useState<SellerData>({ fullName: '', position: 'rahbari', phone: '', email: null, legalForm: 'fermer', farmName: '', tin: '', regNumber: '', regDate: '', region: '', district: '', address: '', landArea: '', employees: '', activity: [], extra: '' });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ftype, setFtype] = useState<Attachment['type']>('certificate');
  useEffect(() => {
    const s = tpl.data?.seller;
    if (s) setD((x) => ({ ...x, fullName: x.fullName || s.fullName, phone: x.phone || s.phone || '', email: x.email ?? s.email, farmName: x.farmName || s.farmName, tin: x.tin || s.tin || '', region: x.region || s.region, district: x.district || s.district, address: x.address || s.address }));
  }, [tpl.data]);
  const set = <K extends keyof SellerData>(k: K, v: SellerData[K]) => setD((x) => ({ ...x, [k]: v }));
  const upload = async (f: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const { key } = await api.upload<{ key: string }>('/uploads/documents', fd);
      setFiles((x) => [...x, { key, name: f.name.slice(0, 110), type: ftype }]);
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const m = useMutation({
    mutationFn: () => api.post<{ id: string }>('/applications/seller', { data: { ...d, landArea: Number(d.landArea || 0), employees: Number(d.employees || 0), email: d.email || null }, attachments: files, password, agree: true }),
    onSuccess: (r) => { toast(t('z.app.sent')); void qc.invalidateQueries({ queryKey: ['applications'] }); nav(`/seller/applications/${r.id}`); },
    onError: (e) => toast(err(e), 'error'),
  });
  const districts = regions.find((r) => r.code === d.region)?.districts ?? [];
  const valid = d.fullName.length >= 5 && /^\d{9}$/.test(d.tin) && d.farmName.length >= 2 && d.regNumber.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(d.regDate) && d.region && d.district && d.address.length >= 5 && d.activity.length > 0 && files.length > 0;
  const preview = { number: t('z.app.draftNo'), kind: 'SELLER' as Kind, data: d as unknown as Record<string, unknown>, attachments: files, createdAt: new Date().toISOString(), contentHash: null, status: 'pending' as Status, reviewNote: null, reviewedAt: null, items: [], seller: { id: '', farmName: d.farmName, slug: '', region: d.region, district: d.district, address: d.address, tin: d.tin, verificationStatus: '', user: { fullName: user?.fullName ?? '', phone: user?.phone ?? null, email: user?.email ?? null } } };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_520px]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">1. {t('z.app.sec_applicant')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('z.app.f_fullName')} required><Input value={d.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Familiya Ism Otasining ismi" /></Field>
            <Field label={t('z.app.f_position')}><Input value={d.position} onChange={(e) => set('position', e.target.value)} /></Field>
            <Field label={t('common.phone')} required><Input value={d.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          </div>
        </Card>
        <Card className="space-y-4 p-5">
          <h2 className="font-extrabold">2. {t('z.app.sec_farm')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('z.app.f_legalForm')} required><Select value={d.legalForm} onChange={(e) => set('legalForm', e.target.value as SellerData['legalForm'])}>{(['fermer', 'dehqon', 'mchj', 'yatt', 'kooperativ'] as const).map((x) => <option key={x} value={x}>{t(`z.app.lf_${x}` as TKey)}</option>)}</Select></Field>
            <Field label={t('z.app.f_farmName')} required><Input value={d.farmName} onChange={(e) => set('farmName', e.target.value)} /></Field>
            <Field label={t('y.contract.tin')} required hint={t('z.app.tinHint')}><Input inputMode="numeric" maxLength={9} value={d.tin} onChange={(e) => set('tin', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label={t('z.app.f_regNumber')} required><Input value={d.regNumber} onChange={(e) => set('regNumber', e.target.value)} placeholder="FX-000000" /></Field>
            <Field label={t('z.app.f_regDate')} required><Input type="date" value={d.regDate} onChange={(e) => set('regDate', e.target.value)} /></Field>
            <Field label={t('z.app.f_landArea')}><Input type="number" min={0} step="0.1" value={d.landArea} onChange={(e) => set('landArea', e.target.value)} /></Field>
            <Field label={t('z.field.region')} required><Select value={d.region} onChange={(e) => setD((x) => ({ ...x, region: e.target.value, district: '' }))}><option value="">—</option>{regions.map((r) => <option key={r.code} value={r.code}>{r[lang]}</option>)}</Select></Field>
            <Field label={t('z.field.district')} required><Select value={d.district} onChange={(e) => set('district', e.target.value)}><option value="">—</option>{districts.map((x) => <option key={x} value={x}>{x}</option>)}</Select></Field>
            <Field label={t('z.field.address')} required className="sm:col-span-2"><Input value={d.address} onChange={(e) => set('address', e.target.value)} placeholder={t('z.app.addressPh')} /></Field>
            <Field label={t('z.app.f_employees')}><Input type="number" min={0} value={d.employees} onChange={(e) => set('employees', e.target.value)} /></Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('z.app.f_activity')} *</p>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITIES.map((a) => {
                const on = d.activity.includes(a);
                return <button key={a} type="button" onClick={() => set('activity', on ? d.activity.filter((x) => x !== a) : [...d.activity, a])} className={cx('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1', on ? 'bg-brand text-white ring-brand' : 'bg-white ring-cream-300')}>{on && <Check className="h-3 w-3" />}{a}</button>;
              })}
            </div>
          </div>
          <Field label={t('z.app.f_extra')}><Textarea rows={2} value={d.extra} onChange={(e) => set('extra', e.target.value)} /></Field>
        </Card>
        <Card className="space-y-3 p-5">
          <h2 className="font-extrabold">3. {t('z.app.sec_docs')}</h2>
          <p className="text-xs text-muted">{t('z.app.docsHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Select value={ftype} onChange={(e) => setFtype(e.target.value as Attachment['type'])} className="max-w-[240px]">{(['certificate', 'farm_registry', 'license', 'land', 'passport', 'other'] as const).map((x) => <option key={x} value={x}>{t(`z.app.at_${x}` as TKey)}</option>)}</Select>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            <Button variant="outline" loading={busy} disabled={files.length >= 10} onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" />{t('z.app.attach')}</Button>
          </div>
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li key={f.key} className="flex items-center gap-2 rounded-xl bg-cream-100 px-3 py-2 text-sm"><Paperclip className="h-4 w-4 text-brand" /><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-muted">{t(`z.app.at_${f.type}` as TKey)}</span><button type="button" onClick={() => setFiles((x) => x.filter((y) => y.key !== f.key))} aria-label={t('common.delete')}><X className="h-4 w-4 text-danger" /></button></li>
            ))}
          </ul>
        </Card>
        <SignBox password={password} setPassword={setPassword} agree={agree} setAgree={setAgree} loading={m.isPending} disabled={!valid} onSubmit={() => m.mutate()} />
        {!valid && <p className="text-xs text-muted">{t('z.app.fillAll')}</p>}
      </div>
      <div className="xl:sticky xl:top-20 xl:self-start"><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('z.app.preview')}</p><div className="origin-top xl:scale-[0.9]"><ApplicationDocument a={preview} preview /></div></div>
    </div>
  );
}

// Mahsulot tavsifi shablonlari — fermer bir bosishda to'ldiradi va keyin tahrirlaydi
const DESC_TEMPLATES: { key: string; text: string }[] = [
  { key: 'fresh', text: "Yangi hosil, bugun terilgan. Kimyoviy o'g'itlarsiz yetishtirilgan. Saqlash: salqin, quruq joyda, 7–10 kun." },
  { key: 'organic', text: "Organik usulda yetishtirilgan: faqat tabiiy o'g'it (go'ng, kompost), pestitsidsiz. Hosil yig'ilgan sana buyurtmada ko'rsatiladi." },
  { key: 'wholesale', text: "Ulgurji xaridorlar uchun: qoplarda/yashiklarda qadoqlangan, 100 kg dan ortiq buyurtmaga chegirma va yetkazib berish." },
  { key: 'dairy', text: "Bugun sog'ilgan, sovutilgan holda yetkaziladi. Saqlash: +2…+6 °C, 3 kungacha. Veterinariya ma'lumotnomasi mavjud." },
];

interface NewItem { key: number; name: string; categoryId: string; description: string; price: string; unit: 'kg' | 'g' | 'tonna' | 'dona' | 'litr' | 'qop'; stock: string; minOrderQty: string; isOrganic: boolean; isSeasonal: boolean; images: { url: string; thumbUrl?: string | null }[] }
let seq = 1;
const blankItem = (): NewItem => ({ key: seq++, name: '', categoryId: '', description: '', price: '', unit: 'kg', stock: '', minOrderQty: '1', isOrganic: false, isSeasonal: false, images: [] });

function ProposeCategory({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [n, setN] = useState({ nameUz: '', nameRu: '', nameEn: '' });
  const m = useMutation({ mutationFn: () => api.post<{ id: string; isActive: boolean }>('/applications/categories', { nameUz: n.nameUz.trim(), nameRu: n.nameRu.trim() || undefined, nameEn: n.nameEn.trim() || undefined }), onSuccess: (c) => { toast(c.isActive ? t('z.app.catExists') : t('z.app.catProposed')); void qc.invalidateQueries({ queryKey: ['applications', 'template'] }); onCreated(c.id); onClose(); }, onError: (e) => toast(err(e), 'error') });
  return (
    <Modal open={open} onClose={onClose} title={t('z.app.newCat')} footer={<Button block loading={m.isPending} disabled={n.nameUz.trim().length < 2} onClick={() => m.mutate()}>{t('common.save')}</Button>}>
      <p className="mb-3 text-sm text-ink-soft">{t('z.app.newCatText')}</p>
      <div className="space-y-3">
        <Field label="O'zbekcha" required><Input value={n.nameUz} onChange={(e) => setN({ ...n, nameUz: e.target.value })} /></Field>
        <Field label="Русский"><Input value={n.nameRu} onChange={(e) => setN({ ...n, nameRu: e.target.value })} /></Field>
        <Field label="English"><Input value={n.nameEn} onChange={(e) => setN({ ...n, nameEn: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ProductsForm() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const tpl = useTemplate();
  const drafts = useQuery({ queryKey: ['seller', 'products', 'drafts'], queryFn: async () => [...(await api.get<{ id: string; name: string; status: string; image: { url: string; thumbUrl: string | null } | null }[]>('/products/mine?status=draft&limit=50')), ...(await api.get<{ id: string; name: string; status: string; image: { url: string; thumbUrl: string | null } | null }[]>('/products/mine?status=rejected&limit=50'))] });
  const [ids, setIds] = useState<string[]>(() => sp.get('ids')?.split(',').filter(Boolean) ?? []);
  const [items, setItems] = useState<NewItem[]>(() => (sp.get('ids') ? [] : [blankItem()]));
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [propose, setPropose] = useState<number | null>(null);
  const cats = tpl.data?.categories ?? [];
  const leafCats = cats.filter((c) => c.parentId || !cats.some((x) => x.parentId === c.id));
  const upd = (k: number, patch: Partial<NewItem>) => setItems((x) => x.map((i) => (i.key === k ? { ...i, ...patch } : i)));
  const okItem = (i: NewItem) => i.name.trim().length >= 2 && i.categoryId && i.description.trim().length >= 10 && Number(i.price) > 0 && i.images.length > 0 && i.stock !== '';
  const valid = ids.length + items.length > 0 && items.every(okItem);
  const m = useMutation({
    mutationFn: () => api.post<{ id: string }>('/applications/products', {
      productIds: ids,
      items: items.map((i) => ({ name: i.name.trim(), categoryId: i.categoryId, description: i.description.trim(), price: Number(i.price), unit: i.unit, stock: Number(i.stock), minOrderQty: Number(i.minOrderQty || 1), isOrganic: i.isOrganic, isSeasonal: i.isSeasonal, images: i.images })),
      note, password, agree: true,
    }),
    onSuccess: (r) => { toast(t('z.app.sent')); void qc.invalidateQueries({ queryKey: ['applications'] }); void qc.invalidateQueries({ queryKey: ['seller'] }); nav(`/seller/applications/${r.id}`); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div className="space-y-4">
      <Card className="flex gap-3 bg-sky-50 p-4 text-sm text-sky-900"><Sparkles className="h-5 w-5 shrink-0" /><p>{t('z.app.productsHint')}</p></Card>
      {!!drafts.data?.length && (
        <Card className="p-4">
          <p className="mb-2 font-extrabold">{t('z.app.fromDrafts')}</p>
          <div className="flex flex-wrap gap-2">
            {drafts.data.map((p) => {
              const on = ids.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => setIds((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))} className={cx('flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3 text-sm font-semibold ring-2', on ? 'bg-brand-50 ring-brand' : 'bg-white ring-cream-200')}>
                  <img src={img(p.image?.thumbUrl ?? p.image?.url)} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  {p.name}
                  <StatusBadge status={p.status} kind="prod" />
                  {on && <Check className="h-4 w-4 text-brand" />}
                </button>
              );
            })}
          </div>
        </Card>
      )}
      {items.map((it, idx) => (
        <Card key={it.key} className={cx('space-y-3 p-4', okItem(it) && 'ring-2 ring-brand/30')}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-extrabold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs text-white">{idx + 1}</span>{it.name || t('z.app.newProduct')}{okItem(it) && <CheckCircle2 className="h-4 w-4 text-brand" />}</p>
            <button type="button" onClick={() => setItems((x) => x.filter((y) => y.key !== it.key))} className="rounded-lg p-1.5 text-danger hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('seller.productName')} required><Input value={it.name} onChange={(e) => upd(it.key, { name: e.target.value })} /></Field>
            <Field label={t('admin.categories')} required>
              <div className="flex gap-2">
                <Select value={it.categoryId} onChange={(e) => upd(it.key, { categoryId: e.target.value })} className="flex-1">
                  <option value="">—</option>
                  {leafCats.map((c) => <option key={c.id} value={c.id}>{catName(c, lang)}{c.isActive ? '' : ` (${t('z.app.catPending')})`}</option>)}
                </Select>
                <Button variant="outline" size="icon" title={t('z.app.newCat')} onClick={() => setPropose(it.key)}><Plus className="h-4 w-4" /></Button>
              </div>
            </Field>
            <Field label={t('common.price')} required><Input type="number" min={0} value={it.price} onChange={(e) => upd(it.key, { price: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('y.contract.unit')}><Select value={it.unit} onChange={(e) => upd(it.key, { unit: e.target.value as NewItem['unit'] })}>{(['kg', 'g', 'tonna', 'dona', 'litr', 'qop'] as const).map((u) => <option key={u} value={u}>{t(`units.${u}` as TKey)}</option>)}</Select></Field>
              <Field label={t('seller.stock')} required><Input type="number" min={0} value={it.stock} onChange={(e) => upd(it.key, { stock: e.target.value })} /></Field>
              <Field label={t('z.app.minQty')}><Input type="number" min={0} value={it.minOrderQty} onChange={(e) => upd(it.key, { minOrderQty: e.target.value })} /></Field>
            </div>
          </div>
          <Field label={t('z.field.description')} required>
            <Textarea rows={3} value={it.description} onChange={(e) => upd(it.key, { description: e.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs font-semibold text-muted">{t('z.app.templates')}:</span>
            {DESC_TEMPLATES.map((x) => <button key={x.key} type="button" onClick={() => upd(it.key, { description: it.description ? `${it.description}\n${x.text}` : x.text, isOrganic: it.isOrganic || x.key === 'organic' })} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-50">+ {t(`z.app.tpl_${x.key}` as TKey)}</button>)}
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox checked={it.isOrganic} onChange={(e) => upd(it.key, { isOrganic: e.target.checked })} label={t('z.app.organic')} />
            <Checkbox checked={it.isSeasonal} onChange={(e) => upd(it.key, { isSeasonal: e.target.checked })} label={t('z.app.seasonal')} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('z.app.photos')} *</p>
            <ImageUploader value={it.images} onChange={(v) => upd(it.key, { images: v })} max={8} />
          </div>
        </Card>
      ))}
      <Button variant="outline" onClick={() => setItems((x) => [...x, blankItem()])} disabled={items.length + ids.length >= 50}><Plus className="h-4 w-4" />{t('z.app.addProduct')}</Button>
      <Card className="p-4"><Field label={t('z.app.note')}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field></Card>
      <p className="text-sm font-bold">{t('z.app.total', { n: items.length + ids.length })}</p>
      <SignBox password={password} setPassword={setPassword} agree={agree} setAgree={setAgree} loading={m.isPending} disabled={!valid} onSubmit={() => m.mutate()} />
      <ProposeCategory open={propose !== null} onClose={() => setPropose(null)} onCreated={(id) => propose !== null && upd(propose, { categoryId: id })} />
    </div>
  );
}

function PartnershipForm() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tpl = useTemplate();
  const { regions } = useRegions();
  const [couriers, setCouriers] = useState('1');
  const [vehicles, setVehicles] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  useEffect(() => {
    if (tpl.data && !sel.length) setSel([tpl.data.seller.region]);
  }, [tpl.data, sel.length]);
  const m = useMutation({ mutationFn: () => api.post<{ id: string }>('/applications/partnership', { couriers: Number(couriers), vehicles, regions: sel, note, password, agree: true }), onSuccess: (r) => { toast(t('z.app.sent')); void qc.invalidateQueries({ queryKey: ['applications'] }); nav(`/seller/applications/${r.id}`); }, onError: (e) => toast(err(e), 'error') });
  const pct = tpl.data?.partnerSharePercent ?? 0;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('z.app.f_couriers')}><Input type="number" min={0} value={couriers} onChange={(e) => setCouriers(e.target.value)} /></Field>
            <Field label={t('z.app.f_vehicles')}><Input value={vehicles} onChange={(e) => setVehicles(e.target.value)} placeholder="Damas, Labo, Isuzu…" /></Field>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold">{t('z.app.f_regions')}</p>
            <div className="flex flex-wrap gap-1.5">
              {regions.map((r) => {
                const on = sel.includes(r.code);
                return <button key={r.code} type="button" onClick={() => setSel((x) => (on ? x.filter((y) => y !== r.code) : [...x, r.code]))} className={cx('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1', on ? 'bg-brand text-white ring-brand' : 'bg-white ring-cream-300')}>{on && <Check className="h-3 w-3" />}{r[lang]}</button>;
              })}
            </div>
          </div>
          <Field label={t('z.app.note')}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Card>
        <SignBox password={password} setPassword={setPassword} agree={agree} setAgree={setAgree} loading={m.isPending} disabled={!sel.length} onSubmit={() => m.mutate()} />
      </div>
      <Card className="h-fit space-y-3 bg-brand-900 p-5 text-white">
        <Handshake className="h-8 w-8 text-lime" />
        <p className="text-lg font-extrabold">{t('z.app.partnerOffer', { p: pct })}</p>
        <ul className="space-y-1.5 text-sm text-white/85">{(['b1', 'b2', 'b3', 'b4'] as const).map((k) => <li key={k} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" />{t(`z.staff.${k}` as TKey)}</li>)}</ul>
        <p className="text-xs text-white/60">{t('z.app.partnerNote')}</p>
      </Card>
    </div>
  );
}

export function ApplicationNew() {
  const { kind = 'seller' } = useParams();
  const { t } = useI18n();
  const k = kind.toUpperCase() as Kind;
  return (
    <div>
      <Link to="/seller/applications" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('z.nav.applications')}</Link>
      <PageHeader title={t(`z.app.k_${k}` as TKey)} subtitle={t(`z.app.d_${k}` as TKey)} />
      {k === 'SELLER' ? <SellerForm /> : k === 'PRODUCTS' ? <ProductsForm /> : <PartnershipForm />}
    </div>
  );
}

// ───────── Admin: arizalar ─────────
export function AdminApplications() {
  const { t, lang } = useI18n();
  const [kind, setKind] = useState<Kind | ''>('');
  const [status, setStatus] = useState<Status | ''>('pending');
  const q = useQuery({ queryKey: ['applications', 'admin', kind, status], queryFn: () => api.page<Application[]>(`/applications?${new URLSearchParams(Object.entries({ kind, status }).filter(([, v]) => v) as [string, string][]).toString()}`) });
  const counts = (q.data?.meta as unknown as { counts?: { kind: Kind; status: Status; n: number }[] } | undefined)?.counts ?? [];
  const pendingOf = (k?: Kind) => counts.filter((c) => c.status === 'pending' && (!k || c.kind === k)).reduce((a, c) => a + c.n, 0);
  return (
    <div>
      <PageHeader title={t('z.nav.applications')} subtitle={t('z.app.adminSubtitle')} />
      <Tabs className="mb-3" value={kind || 'all'} onChange={(v) => setKind(v === 'all' ? '' : (v as Kind))} items={[{ value: 'all', label: t('y.users.all'), count: pendingOf() || undefined }, ...(['SELLER', 'PRODUCTS', 'PARTNERSHIP'] as const).map((k) => ({ value: k, label: t(`z.app.k_${k}` as TKey), count: pendingOf(k) || undefined }))]} />
      <Tabs className="mb-4" value={status || 'all'} onChange={(v) => setStatus(v === 'all' ? '' : (v as Status))} items={[{ value: 'pending', label: t('z.app.s_pending') }, { value: 'approved', label: t('z.app.s_approved') }, { value: 'partially_approved', label: t('z.app.s_partially_approved') }, { value: 'rejected', label: t('z.app.s_rejected') }, { value: 'all', label: t('y.users.all') }]} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.data.length ? <Card className="p-8"><Empty icon={<FileCheck2 className="h-8 w-8" />} title={t('z.app.noPending')} /></Card> : (
        <div className="space-y-2.5">
          {q.data.data.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <Link key={a.id} to={`/admin/applications/${a.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-cream-200 hover:ring-brand/40">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{a.seller.farmName} · <span className="font-normal text-ink-soft">{t(`z.app.k_${a.kind}` as TKey)}{a.kind === 'PRODUCTS' ? ` (${a._count?.items ?? 0})` : ''}</span></p>
                  <p className="text-xs text-muted">№ {a.number} · {a.seller.user.fullName} · {dateTime(a.createdAt, lang)}</p>
                </div>
                <AppStatus s={a.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminApplicationDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['applications', id], queryFn: () => api.get<Application>(`/applications/${id}`) });
  const a = q.data;
  const [approve, setApprove] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [pct, setPct] = useState('');
  useEffect(() => {
    if (a) {
      setApprove(new Set(a.items.map((i) => i.id)));
      setPct(String((a.data as { proposedPercent?: number }).proposedPercent ?? ''));
    }
  }, [a]);
  const m = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => api.post<{ status: Status; partnership: string | null }>(`/applications/${id}/review`, {
      decision, note,
      ...(a?.kind === 'PRODUCTS' ? { approveItemIds: [...approve], itemNotes: Object.fromEntries(Object.entries(notes).filter(([k, v]) => v && !approve.has(k))) } : {}),
      ...(a?.kind === 'PARTNERSHIP' && pct ? { sharePercent: Number(pct) } : {}),
    }),
    onSuccess: (r) => { toast(t(`z.app.s_${r.status}` as TKey)); void qc.invalidateQueries({ queryKey: ['applications'] }); },
    onError: (e) => toast(err(e), 'error'),
  });
  const counts = useMemo(() => ({ yes: approve.size, no: (a?.items.length ?? 0) - approve.size }), [approve, a]);
  if (!a) return <Skeleton className="h-[70vh]" />;
  const pending = a.status === 'pending';
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/admin/applications" className="inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('z.nav.applications')}</Link>
        <div className="flex items-center gap-2"><AppStatus s={a.status} /><Link to={`/admin/users/${(a.seller as unknown as { userId?: string }).userId ?? ''}`}><Button size="sm" variant="outline">{t('z.app.applicantCard')}</Button></Link><Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button></div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <ApplicationDocument a={a} />
        <div className="no-print space-y-4 xl:sticky xl:top-20 xl:self-start">
          {a.kind === 'PRODUCTS' && (
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-extrabold">{t('z.app.items')}</p>
                {pending && <div className="flex gap-2 text-xs"><button type="button" className="font-bold text-brand" onClick={() => setApprove(new Set(a.items.map((i) => i.id)))}>{t('z.app.all')}</button><button type="button" className="font-bold text-muted" onClick={() => setApprove(new Set())}>{t('z.app.none')}</button></div>}
              </div>
              <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {a.items.map((i) => {
                  const on = approve.has(i.id);
                  const p = i.product;
                  return (
                    <li key={i.id} className={cx('rounded-xl p-2.5 ring-2', !pending ? (i.status === 'approved' ? 'ring-brand/40' : 'ring-danger/30') : on ? 'bg-brand-50/50 ring-brand' : 'ring-cream-200')}>
                      <label className="flex cursor-pointer items-start gap-2.5">
                        {pending && <input type="checkbox" checked={on} onChange={(e) => setApprove((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} className="mt-1 h-5 w-5 accent-[#1F6B45]" />}
                        <img src={img(p?.images[0]?.thumbUrl ?? p?.images[0]?.url)} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{p?.name}</span>
                          <span className="block text-xs text-muted">{p ? catName(p.category, lang) : ''}{p && !p.category.isActive ? ` · ${t('z.app.newCatBadge')}` : ''} · {money(p?.price, lang)} / {t(`units.${p?.unit ?? 'kg'}` as TKey)}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{p?.description}</span>
                          {p && p.images.length > 1 && <span className="mt-1 flex gap-1">{p.images.slice(1).map((im, k) => <img key={k} src={img(im.thumbUrl ?? im.url)} alt="" className="h-8 w-8 rounded object-cover" />)}</span>}
                        </span>
                      </label>
                      {pending && !on && <Input className="mt-2 !h-9 text-xs" value={notes[i.id] ?? ''} onChange={(e) => setNotes((x) => ({ ...x, [i.id]: e.target.value }))} placeholder={t('z.app.itemReason')} />}
                      {!pending && i.note && <p className="mt-1 text-xs text-danger">{i.note}</p>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {a.kind === 'PARTNERSHIP' && pending && <Card className="p-4"><Field label={t('z.app.f_share')} hint={t('z.app.shareHint')}><Input type="number" min={0} max={50} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)} /></Field></Card>}
          {a.kind === 'SELLER' && (
            <Card className="p-4 text-sm">
              <p className="mb-1 font-extrabold">{t('z.app.checklist')}</p>
              <ul className="space-y-1 text-ink-soft">{(['c1', 'c2', 'c3', 'c4'] as const).map((k) => <li key={k} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{t(`z.app.${k}` as TKey)}</li>)}</ul>
            </Card>
          )}
          {pending ? (
            <Card className="space-y-3 p-4">
              <Field label={t('z.app.reviewNote')}><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('z.app.reviewNotePh')} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Button loading={m.isPending} disabled={a.kind === 'PRODUCTS' && counts.yes === 0} onClick={() => m.mutate('approve')}><CheckCircle2 className="h-4 w-4" />{a.kind === 'PRODUCTS' && counts.no > 0 ? t('z.app.approveN', { n: counts.yes }) : t('z.app.approve')}</Button>
                <Button variant="danger" loading={m.isPending} disabled={note.trim().length < 3} onClick={() => m.mutate('reject')}><XCircle className="h-4 w-4" />{t('z.app.reject')}</Button>
              </div>
              {a.kind === 'PRODUCTS' && counts.no > 0 && counts.yes > 0 && <p className="text-xs text-muted">{t('z.app.partialHint', { yes: counts.yes, no: counts.no })}</p>}
            </Card>
          ) : (
            <Card className="p-4 text-sm"><p className="font-bold">{t('z.app.reviewed')}</p><p className="text-muted">{a.reviewedAt ? dateTime(a.reviewedAt, lang) : ''}</p></Card>
          )}
        </div>
      </div>
    </div>
  );
}
