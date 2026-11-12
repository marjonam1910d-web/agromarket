import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Boxes, FileDown, MapPin, Package, ShoppingBag, Star, Store, TrendingUp, Users, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useRegions } from '@/hooks';
import { catName, cx, money, num } from '@/utils/format';
import { Button, Card, Empty, ErrorState, Skeleton, Tabs } from '@/components/ui';
import { ReportTable } from './ReportBuilder';
import { CategoryIcon, PageHeader, StatCard, StatusBadge } from '@/components/common';

interface CatRow {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  icon: string | null;
  imageUrl: string | null;
  revenue: number;
  orders: number;
  quantity: number;
  buyers: number;
  averageOrder: number;
  share: number;
  growth: number;
  ordersGrowth: number;
  activeProducts: number;
  sellers: number;
  stock: number;
  rating: number | null;
  reviews: number;
}
interface Detail {
  category: { slug: string; nameUz: string; nameRu: string; nameEn: string; icon: string | null; imageUrl: string | null };
  summary: { revenue: number; orders: number; averageOrder: number; minPrice: number; maxPrice: number; avgPrice: number };
  series: { date: string; revenue: number; orders: number; quantity: number }[];
  subcategories: { id: string; slug: string; nameUz: string; nameRu: string; nameEn: string; revenue: number; orders: number }[];
  topProducts: { id: string; name: string; revenue: number; quantity: number; unit: string; orders: number }[];
  topSellers: { id: string; name: string; revenue: number; orders: number }[];
  regions: { region: string; revenue: number; orders: number }[];
  statuses: Record<string, number>;
}

const PERIODS = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: '365', label: '1y' },
] as const;
type P = (typeof PERIODS)[number]['value'];

function Growth({ v, label }: { v: number; label?: string }) {
  const up = v >= 0;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-bold', up ? 'text-brand' : 'text-danger')} title={label}>
      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {up ? '+' : ''}
      {num(v, 1)}%
    </span>
  );
}

const usePeriod = () => {
  const [p, setP] = useState<P>('30');
  return [p, setP] as const;
};

/** Kategoriyalar ro'yxati — har biri kartochka; bosilsa batafsil sahifa */
export function CategoryReports() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const base = user?.role === 'ADMIN' ? '/admin/reports' : '/seller/reports';
  const [days, setDays] = usePeriod();
  const q = useQuery({ queryKey: ['reports', 'categories', days], queryFn: () => api.get<{ totalRevenue: number; totalOrders: number; categories: CatRow[] }>(`/analytics/categories${qs({ days })}`) });
  const rows = q.data?.categories ?? [];
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div>
      <PageHeader
        title={user?.role === 'ADMIN' ? t('x.reports.title') : t('x.reports.sellerTitle')}
        subtitle={t('x.reports.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={days} onChange={setDays} items={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
            <Link to={`${base}/export`}><Button variant="outline"><FileDown className="h-4 w-4" />{t('z.rep.builder')}</Button></Link>
          </div>
        }
      />
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<Wallet className="h-5 w-5" />} label={`${t('x.reports.revenue')} · ${t('x.reports.days', { n: days })}`} value={q.data ? money(q.data.totalRevenue, lang) : '—'} to={`${base}/view/lines?days=${days}`} />
            <StatCard icon={<ShoppingBag className="h-5 w-5" />} label={t('x.reports.orders')} value={q.data ? q.data.totalOrders : '—'} tone="yellow" to={`${base}/view/orders?days=${days}`} />
            <StatCard icon={<Boxes className="h-5 w-5" />} label={t('x.reports.products')} value={q.data ? rows.reduce((a, r) => a + r.activeProducts, 0) : '—'} tone="blue" to={`${base}/view/products?days=${days}`} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t('admin.categories')} value={q.data ? rows.filter((r) => r.revenue > 0).length + ' / ' + rows.length : '—'} tone="lime" to={`${base}/view/categories?days=${days}`} />
          </div>

          {q.data && rows.some((r) => r.revenue > 0) && (
            <Card className="mt-5 p-5">
              <h2 className="mb-3 font-extrabold">{t('x.reports.share')}</h2>
              <div className="h-[min(420px,calc(32px*var(--n)))]" style={{ ['--n' as string]: rows.filter((r) => r.revenue > 0).length + 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.filter((r) => r.revenue > 0).map((r) => ({ name: catName(r, lang), revenue: r.revenue }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#EFE9DA" />
                    <XAxis type="number" tickFormatter={(v: number) => num(v / 1e6, 1) + 'M'} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={130} fontSize={12} />
                    <Tooltip formatter={(v: number) => money(v, lang)} />
                    <Bar dataKey="revenue" fill="#1F6B45" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {q.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)
              : rows.map((r) => (
                  <Link key={r.id} to={`${base}/${r.slug}?days=${days}`} className="group overflow-hidden rounded-2xl bg-white ring-1 ring-cream-200 transition hover:-translate-y-0.5 hover:shadow-card hover:ring-brand/40">
                    <div className="relative h-28 overflow-hidden bg-brand-50">
                      {r.imageUrl && <img src={r.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/30 to-transparent" />
                      <div className="absolute inset-x-4 bottom-3 flex items-end justify-between text-white">
                        <span className="flex items-center gap-2 text-lg font-extrabold"><CategoryIcon name={r.icon} className="h-5 w-5" />{catName(r, lang)}</span>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold backdrop-blur">{num(r.share, 1)}%</span>
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs font-semibold text-muted">{t('x.reports.revenue')}</p>
                          <p className="text-xl font-extrabold text-ink">{money(r.revenue, lang)}</p>
                        </div>
                        <Growth v={r.growth} label={t('x.reports.vsPrev')} />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream-100"><div className="h-full rounded-full bg-gradient-to-r from-brand to-lime" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
                      <dl className="grid grid-cols-3 gap-2 text-center">
                        {([
                          ['x.reports.orders', r.orders],
                          ['x.reports.buyers', r.buyers],
                          ['x.reports.products', r.activeProducts],
                        ] as [TKey, number][]).map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-cream-100 px-1 py-2">
                            <dt className="truncate text-[10.5px] font-semibold text-muted">{t(k)}</dt>
                            <dd className="text-sm font-extrabold text-ink">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-sun text-sun" />{r.rating ?? '—'} ({r.reviews})</span>
                        {user?.role === 'ADMIN' && <span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" />{r.sellers}</span>}
                        <span className="flex items-center gap-1 font-bold text-brand opacity-0 transition group-hover:opacity-100">{t('common.more')}<ArrowRight className="h-3.5 w-3.5" /></span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Bitta kategoriya bo'yicha batafsil hisobot */
export function CategoryReportDetail() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { slug } = useParams();
  const { regionName } = useRegions();
  const base = user?.role === 'ADMIN' ? '/admin/reports' : '/seller/reports';
  const initial = (new URLSearchParams(window.location.search).get('days') ?? '30') as P;
  const [days, setDays] = useState<P>(PERIODS.some((p) => p.value === initial) ? initial : '30');
  const q = useQuery({ queryKey: ['reports', 'category', slug, days], queryFn: () => api.get<Detail>(`/analytics/categories/${slug}${qs({ days })}`) });
  const d = q.data;
  const unitT = (u: string) => t(`units.${u}` as TKey);
  return (
    <div>
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{t('x.reports.back')}</Link>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !d ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>
      ) : (
        <>
          <div className="relative mb-5 overflow-hidden rounded-3xl bg-brand-800">
            {d.category.imageUrl && <img src={d.category.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-brand-900/70 to-transparent" />
            <div className="relative flex flex-wrap items-end justify-between gap-4 p-6 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-sun">{t('x.reports.title')}</p>
                <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold"><CategoryIcon name={d.category.icon} className="h-7 w-7" />{catName(d.category, lang)}</h1>
                <p className="mt-1 text-sm text-white/75">{t('x.reports.days', { n: days })}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-1 backdrop-blur"><Tabs value={days} onChange={setDays} items={PERIODS.map((p) => ({ value: p.value, label: p.label }))} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<Wallet className="h-5 w-5" />} label={t('x.reports.revenue')} value={money(d.summary.revenue, lang)} />
            <StatCard icon={<ShoppingBag className="h-5 w-5" />} label={t('x.reports.orders')} value={d.summary.orders} tone="yellow" />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t('x.reports.avgOrder')} value={money(d.summary.averageOrder, lang)} tone="blue" />
            <StatCard icon={<Package className="h-5 w-5" />} label={t('x.reports.priceRange')} value={d.summary.maxPrice ? `${num(d.summary.minPrice / 1000, 1)}k – ${num(d.summary.maxPrice / 1000, 1)}k` : '—'} tone="lime" />
          </div>

          <div className="mt-5">
            <ReportTable kind="lines" filter={{ days, categories: [slug ?? ''] }} compact title={t('z.rep.salesOf', { name: catName(d.category, lang) })} />
          </div>

          {!d.series.length ? (
            <Card className="mt-5 p-6"><Empty title={t('x.reports.noData')} /></Card>
          ) : (
            <>
              <Card className="mt-5 p-5">
                <h2 className="mb-3 font-extrabold">{t('x.reports.daily')}</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={d.series} margin={{ left: 0, right: 8 }}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#1F6B45" stopOpacity={0.35} />
                          <stop offset="1" stopColor="#1F6B45" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#EFE9DA" />
                      <XAxis dataKey="date" tickFormatter={(v: string) => v.slice(5)} fontSize={11} />
                      <YAxis tickFormatter={(v: number) => num(v / 1000, 0) + 'k'} fontSize={11} width={44} />
                      <Tooltip formatter={(v: number, k: string) => (k === 'revenue' ? money(v, lang) : v)} />
                      <Area type="monotone" dataKey="revenue" stroke="#1F6B45" strokeWidth={2.5} fill="url(#rev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="mb-3 font-extrabold">{t('x.reports.topProducts')}</h2>
                  <ol className="space-y-2">
                    {d.topProducts.map((p, i) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-xl bg-cream-100 px-3 py-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                          <span className="text-xs text-muted">{num(p.quantity)} {unitT(p.unit)} · {p.orders} {t('x.reports.orders').toLowerCase()}</span>
                        </span>
                        <span className="text-sm font-extrabold text-brand">{money(p.revenue, lang)}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
                <div className="space-y-5">
                  {d.subcategories.length > 1 && (
                    <Card className="p-5">
                      <h2 className="mb-3 font-extrabold">{t('x.reports.subcats')}</h2>
                      <ul className="space-y-2">
                        {d.subcategories.map((s) => {
                          const pct = d.summary.revenue ? (s.revenue / d.summary.revenue) * 100 : 0;
                          return (
                            <li key={s.id}>
                              <div className="flex justify-between text-sm"><span className="font-semibold">{catName(s, lang)}</span><span className="font-bold">{money(s.revenue, lang)}</span></div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-100"><div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} /></div>
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  )}
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-extrabold"><MapPin className="h-4 w-4 text-brand" />{t('x.reports.regions')}</h2>
                    <ul className="divide-y divide-cream-200">
                      {d.regions.map((r) => (
                        <li key={r.region} className="flex justify-between py-2 text-sm"><span>{regionName(r.region)}</span><span className="font-bold">{money(r.revenue, lang)} <span className="font-normal text-muted">· {r.orders}</span></span></li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {d.topSellers.length > 0 && (
                  <Card className="p-5">
                    <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Users className="h-4 w-4 text-brand" />{t('x.reports.topSellers')}</h2>
                    <ul className="divide-y divide-cream-200">
                      {d.topSellers.map((s) => (
                        <li key={s.id} className="flex justify-between py-2 text-sm"><span className="font-semibold">{s.name}</span><span className="font-bold">{money(s.revenue, lang)} <span className="font-normal text-muted">· {s.orders}</span></span></li>
                      ))}
                    </ul>
                  </Card>
                )}
                <Card className="p-5">
                  <h2 className="mb-3 font-extrabold">{t('x.reports.statuses')}</h2>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(d.statuses).map(([s, n]) => (
                      <span key={s} className="flex items-center gap-1.5"><StatusBadge status={s} /> <b className="text-sm">{n}</b></span>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
