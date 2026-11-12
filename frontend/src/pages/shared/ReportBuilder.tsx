import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Boxes, CalendarRange, Check, FileDown, FileSpreadsheet, FolderTree, ListOrdered, Printer, Receipt, ShoppingBag } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, download, qs } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { catName, cx, date, dateTime, money, num } from '@/utils/format';
import { Button, Card, Empty, ErrorState, Input, Select, Skeleton, Tabs } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import type { Category } from '@/types';

export type ReportKind = 'lines' | 'orders' | 'products' | 'categories';
export const REPORT_KINDS: ReportKind[] = ['lines', 'orders', 'products', 'categories'];
const KIND_ICON: Record<ReportKind, typeof Receipt> = { lines: Receipt, orders: ShoppingBag, products: Boxes, categories: FolderTree };
const PERIODS = ['7', '30', '90', '365'] as const;

type Row = Record<string, string | number | null>;
interface Report { from: string; to: string; rows: Row[]; totals: Record<string, number | Record<string, number>> }

export interface ReportFilter { days?: string; from?: string; to?: string; categories?: string[]; status?: string }
const toQuery = (f: ReportFilter, limit?: number) => qs({ days: f.from ? undefined : f.days ?? '30', from: f.from, to: f.to, categories: f.categories?.join(','), status: f.status, limit });

export const useReportBase = () => {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? '/admin/reports' : '/seller/reports';
};

/** Hisobot ma'lumoti */
export function useReport(kind: ReportKind, f: ReportFilter, limit?: number) {
  return useQuery({ queryKey: ['reports', 'builder', kind, f, limit], queryFn: () => api.get<Report>(`/reports/${kind}${toQuery(f, limit)}`) });
}

function useCats() {
  return useQuery({ queryKey: ['public', 'categories'], queryFn: () => api.get<Category[]>('/categories'), staleTime: 5 * 60_000 });
}

/** CSV (Excel) yuklab olish tugmasi */
export function ExportButton({ kind, filter, size = 'sm', label }: { kind: ReportKind; filter: ReportFilter; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const m = useMutation({ mutationFn: () => download(`/reports/${kind}/export${toQuery(filter)}`, `agromarket-${kind}.csv`), onSuccess: (n) => toast(t('z.rep.downloaded', { name: n })), onError: (e) => toast(err(e), 'error') });
  return (
    <Button size={size} variant="outline" loading={m.isPending} onClick={() => m.mutate()}>
      <FileSpreadsheet className="h-4 w-4" />
      {label ?? t('z.rep.excel')}
    </Button>
  );
}

/** Ustunlar va ularning ko'rinishi */
function useColumns(kind: ReportKind) {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const unit = (u: unknown) => {
    const k = `units.${String(u)}` as TKey;
    return t(k) === k ? String(u ?? '') : t(k);
  };
  const m = (v: unknown) => money(Number(v ?? 0), lang, false);
  type Col = { key: string; title: string; render: (r: Row) => ReactNode; right?: boolean; sum?: boolean };
  const cols: Record<ReportKind, Col[]> = {
    lines: [
      { key: 'date', title: t('common.date'), render: (r) => <span className="whitespace-nowrap">{dateTime(String(r.date), lang)}</span> },
      { key: 'number', title: '№', render: (r) => <span className="font-mono text-xs">{r.number}</span> },
      { key: 'product', title: t('z.rep.c_product'), render: (r) => <b>{r.product}</b> },
      { key: 'category', title: t('admin.categories'), render: (r) => r.category ?? '—' },
      { key: 'farm', title: t('z.rep.c_farm'), render: (r) => r.farm },
      { key: 'region', title: t('z.rep.c_region'), render: (r) => regionName(String(r.region ?? '')) },
      { key: 'quantity', title: t('z.rep.c_qty'), render: (r) => `${num(Number(r.quantity))} ${unit(r.unit)}`, right: true },
      { key: 'price', title: t('z.rep.c_price'), render: (r) => m(r.price), right: true },
      { key: 'total', title: t('z.rep.c_sum'), render: (r) => <b>{m(r.total)}</b>, right: true, sum: true },
      { key: 'status', title: t('common.status'), render: (r) => <StatusBadge status={String(r.status)} /> },
    ],
    orders: [
      { key: 'date', title: t('common.date'), render: (r) => <span className="whitespace-nowrap">{dateTime(String(r.date), lang)}</span> },
      { key: 'number', title: '№', render: (r) => <b className="font-mono text-xs">{r.number}</b> },
      { key: 'farm', title: t('z.rep.c_farm'), render: (r) => r.farm },
      { key: 'buyer', title: t('z.rep.c_buyer'), render: (r) => r.buyer },
      { key: 'region', title: t('z.rep.c_region'), render: (r) => regionName(String(r.region ?? '')) },
      { key: 'items', title: t('z.rep.c_items'), render: (r) => r.items, right: true },
      { key: 'deliveryFee', title: t('z.rep.c_delivery'), render: (r) => m(r.deliveryFee), right: true, sum: true },
      { key: 'total', title: t('z.rep.c_sum'), render: (r) => <b>{m(r.total)}</b>, right: true, sum: true },
      { key: 'commission', title: t('z.rep.c_commission'), render: (r) => m(r.commission), right: true, sum: true },
      { key: 'method', title: t('checkout.payment'), render: (r) => t(`z.pay.m_${r.method}` as TKey) },
      { key: 'status', title: t('common.status'), render: (r) => <StatusBadge status={String(r.status)} /> },
    ],
    products: [
      { key: 'name', title: t('z.rep.c_product'), render: (r) => <Link to={`/product/${r.slug}`} className="font-bold text-brand">{r.name}</Link> },
      { key: 'category', title: t('admin.categories'), render: (r) => r.category },
      { key: 'farm', title: t('z.rep.c_farm'), render: (r) => r.farm },
      { key: 'price', title: t('z.rep.c_price'), render: (r) => `${m(r.price)} / ${unit(r.unit)}`, right: true },
      { key: 'stock', title: t('z.rep.c_stock'), render: (r) => num(Number(r.stock)), right: true },
      { key: 'sold', title: t('z.rep.c_sold'), render: (r) => num(Number(r.sold)), right: true },
      { key: 'revenue', title: t('z.rep.c_revenue'), render: (r) => <b>{m(r.revenue)}</b>, right: true, sum: true },
      { key: 'rating', title: '★', render: (r) => (Number(r.rating) ? num(Number(r.rating), 1) : '—'), right: true },
      { key: 'status', title: t('common.status'), render: (r) => <StatusBadge status={String(r.status)} kind="prod" /> },
    ],
    categories: [
      { key: 'name', title: t('admin.categories'), render: (r) => <b>{r.name}</b> },
      { key: 'revenue', title: t('z.rep.c_revenue'), render: (r) => <b>{m(r.revenue)}</b>, right: true, sum: true },
      { key: 'share', title: '%', render: (r) => `${r.share}%`, right: true },
      { key: 'orders', title: t('x.reports.orders'), render: (r) => r.orders, right: true, sum: true },
      { key: 'activeProducts', title: t('z.rep.c_active'), render: (r) => r.activeProducts, right: true, sum: true },
      { key: 'minPrice', title: t('z.rep.c_min'), render: (r) => m(r.minPrice), right: true },
      { key: 'avgPrice', title: t('z.rep.c_avg'), render: (r) => m(r.avgPrice), right: true },
      { key: 'maxPrice', title: t('z.rep.c_max'), render: (r) => m(r.maxPrice), right: true },
    ],
  };
  return cols[kind];
}

/** Hisobot jadvali (ekran + chop etish). `compact` — boshqa sahifa ichida */
export function ReportTable({ kind, filter, compact, title }: { kind: ReportKind; filter: ReportFilter; compact?: boolean; title?: string }) {
  const { t, lang } = useI18n();
  const q = useReport(kind, filter, compact ? 200 : 1000);
  const cols = useColumns(kind);
  const r = q.data;
  const sums = useMemo(() => Object.fromEntries(cols.filter((c) => c.sum).map((c) => [c.key, (r?.rows ?? []).reduce((a, x) => a + Number(x[c.key] ?? 0), 0)])), [cols, r]);
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!r) return <Skeleton className="h-64" />;
  return (
    <Card className="report-sheet overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
        <div>
          <h2 className="font-extrabold text-ink">{title ?? t(`z.rep.k_${kind}` as TKey)}</h2>
          <p className="text-xs text-muted">{date(r.from, lang)} — {date(r.to, lang)} · {t('z.rep.rows', { n: r.rows.length })}</p>
        </div>
        <div className="no-print flex gap-2">
          <ExportButton kind={kind} filter={filter} />
          <Button size="sm" variant="ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />PDF</Button>
        </div>
      </div>
      {!r.rows.length ? (
        <div className="p-6"><Empty title={t('x.reports.noData')} /></div>
      ) : (
        <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-cream-50 text-[11px] uppercase tracking-wide text-muted">
              <tr>{cols.map((c) => <th key={c.key} className={cx('px-3 py-2 font-bold', c.right && 'text-right')}>{c.title}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {r.rows.map((row, i) => (
                <tr key={String(row.id ?? row.orderId ?? i) + i} className="hover:bg-cream-50">
                  {cols.map((c) => <td key={c.key} className={cx('px-3 py-2', c.right && 'text-right tabular-nums')}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ink/10 bg-cream-50 font-extrabold">
              <tr>
                {cols.map((c, i) => (
                  <td key={c.key} className={cx('px-3 py-2', c.right && 'text-right tabular-nums')}>{i === 0 ? t('common.total') : c.sum ? money(sums[c.key], lang, false) : ''}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Davr va kategoriya filtrlari */
function Filters({ value, onChange, kind }: { value: ReportFilter; onChange: (f: ReportFilter) => void; kind?: ReportKind }) {
  const { t, lang } = useI18n();
  const cats = useCats();
  const roots = (cats.data ?? []).filter((c) => !c.parentId);
  const [custom, setCustom] = useState(Boolean(value.from));
  const sel = new Set(value.categories ?? []);
  const toggle = (slug: string) => {
    const n = new Set(sel);
    if (n.has(slug)) n.delete(slug);
    else n.add(slug);
    onChange({ ...value, categories: [...n] });
  };
  return (
    <Card className="no-print space-y-4 p-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted"><CalendarRange className="h-3.5 w-3.5" />{t('z.rep.period')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={custom ? 'custom' : value.days ?? '30'} onChange={(v) => { if (v === 'custom') { setCustom(true); onChange({ ...value, from: value.from ?? new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10), to: value.to ?? new Date().toISOString().slice(0, 10) }); } else { setCustom(false); onChange({ ...value, days: v, from: undefined, to: undefined }); } }} items={[...PERIODS.map((p) => ({ value: p as string, label: t('x.reports.days', { n: p }) })), { value: 'custom', label: t('z.rep.custom') }]} />
          {custom && (
            <div className="flex items-center gap-2">
              <Input type="date" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value })} className="!h-10 w-40" />
              <span className="text-muted">—</span>
              <Input type="date" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} className="!h-10 w-40" />
            </div>
          )}
        </div>
      </div>
      <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{t('admin.categories')} {sel.size ? `· ${sel.size}` : `· ${t('y.users.all').toLowerCase()}`}</p>
            {sel.size > 0 && <button type="button" onClick={() => onChange({ ...value, categories: [] })} className="text-xs font-bold text-brand">{t('z.rep.clear')}</button>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {roots.map((c) => (
              <button key={c.id} type="button" onClick={() => toggle(c.slug)} className={cx('flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition', sel.has(c.slug) ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-cream-300 hover:ring-brand/40')}>
                {sel.has(c.slug) && <Check className="h-3 w-3" />}
                {catName(c, lang)}
              </button>
            ))}
          </div>
        </div>
      {(kind === 'orders' || kind === 'lines') && (
        <div className="max-w-xs">
          <Select value={value.status ?? ''} onChange={(e) => onChange({ ...value, status: e.target.value || undefined })}>
            <option value="">{t('z.rep.allLive')}</option>
            {['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s} value={s}>{t(`status.${s}` as TKey)}</option>)}
          </Select>
        </div>
      )}
      {kind === 'products' && (
        <div className="max-w-xs">
          <Select value={value.status ?? ''} onChange={(e) => onChange({ ...value, status: e.target.value || undefined })}>
            <option value="">{t('status.prod_active')}</option>
            {['out_of_stock', 'inactive', 'pending_review', 'draft', 'rejected'].map((s) => <option key={s} value={s}>{t(`status.prod_${s}` as TKey)}</option>)}
          </Select>
        </div>
      )}
    </Card>
  );
}

const fromParams = (sp: URLSearchParams): ReportFilter => ({
  days: sp.get('days') ?? '30',
  from: sp.get('from') ?? undefined,
  to: sp.get('to') ?? undefined,
  categories: sp.get('categories')?.split(',').filter(Boolean) ?? [],
  status: sp.get('status') ?? undefined,
});

/** Bitta hisobot (statistika kartochkasi bosilganda ochiladi) */
export function ReportViewPage() {
  const { t } = useI18n();
  const { kind = 'lines' } = useParams();
  const [sp, setSp] = useSearchParams();
  const base = useReportBase();
  const nav = useNavigate();
  const f = fromParams(sp);
  const k = (REPORT_KINDS.includes(kind as ReportKind) ? kind : 'lines') as ReportKind;
  const set = (n: ReportFilter) => setSp(Object.fromEntries(Object.entries({ days: n.from ? '' : n.days, from: n.from, to: n.to, categories: n.categories?.join(','), status: n.status }).filter(([, v]) => v)) as Record<string, string>, { replace: true });
  return (
    <div className="space-y-4">
      <Link to={base} className="no-print inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('x.reports.back')}</Link>
      <PageHeader title={t(`z.rep.k_${k}` as TKey)} subtitle={t(`z.rep.d_${k}` as TKey)} actions={<Link to={`${base}/export`} className="no-print"><Button variant="outline"><FileDown className="h-4 w-4" />{t('z.rep.builder')}</Button></Link>} />
      <div className="no-print"><Tabs value={k} onChange={(v) => nav(`${base}/view/${v}?${sp.toString()}`, { replace: true })} items={REPORT_KINDS.map((x) => ({ value: x, label: t(`z.rep.k_${x}` as TKey) }))} /></div>
      <Filters value={f} onChange={set} kind={k} />
      <ReportTable kind={k} filter={f} />
    </div>
  );
}

/** Hujjat tayyorlash bo'limi: hisobot turi, davr, kategoriyalar → Excel yoki PDF */
export function ReportExportPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const base = useReportBase();
  const [kinds, setKinds] = useState<ReportKind[]>(['lines']);
  const [f, setF] = useState<ReportFilter>({ days: '30', categories: [] });
  const [preview, setPreview] = useState(false);
  const toggle = (k: ReportKind) => setKinds((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));
  return (
    <div className="space-y-4">
      <Link to={base} className="no-print inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('x.reports.back')}</Link>
      <PageHeader title={t('z.rep.builder')} subtitle={t('z.rep.builderText')} />
      <div className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REPORT_KINDS.map((k) => {
          const Icon = KIND_ICON[k];
          const on = kinds.includes(k);
          return (
            <button key={k} type="button" onClick={() => toggle(k)} className={cx('relative flex flex-col items-start gap-2 rounded-2xl bg-white p-4 text-left ring-2 transition', on ? 'ring-brand shadow-card' : 'ring-cream-200 hover:ring-brand/30')}>
              <span className={cx('absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full ring-2', on ? 'bg-brand text-white ring-brand' : 'ring-cream-300')}>{on && <Check className="h-4 w-4" />}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon className="h-5 w-5" /></span>
              <b className="text-ink">{t(`z.rep.k_${k}` as TKey)}</b>
              <span className="text-xs leading-snug text-muted">{t(`z.rep.d_${k}` as TKey)}</span>
            </button>
          );
        })}
      </div>
      <Filters value={f} onChange={setF} />
      <Card className="no-print flex flex-wrap items-center gap-3 p-4">
        <ListOrdered className="h-5 w-5 text-brand" />
        <p className="flex-1 text-sm text-ink-soft">{t('z.rep.selected', { n: kinds.length })}</p>
        {kinds.map((k) => <ExportButton key={k} kind={k} filter={f} label={`${t(`z.rep.k_${k}` as TKey)} · Excel`} />)}
        <Button disabled={!kinds.length} onClick={() => setPreview(true)}><Printer className="h-4 w-4" />{t('z.rep.makeDoc')}</Button>
      </Card>
      {preview && (
        <div className="space-y-4">
          <div className="report-doc-head hidden print:block">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand">AgroMarket</p>
            <h1 className="text-xl font-extrabold">{t('z.rep.docTitle')}</h1>
            <p className="text-xs text-muted">{user?.sellerProfile?.farmName ?? user?.fullName} · {new Date().toLocaleString()}</p>
          </div>
          <div className="no-print flex justify-end"><Button onClick={() => window.print()}><Printer className="h-4 w-4" />{t('z.rep.printPdf')}</Button></div>
          {kinds.map((k) => <ReportTable key={k} kind={k} filter={f} />)}
        </div>
      )}
    </div>
  );
}
