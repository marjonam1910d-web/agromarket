import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CreditCard, MessageSquareWarning, Package, ShoppingBag, Store, TrendingUp, Users, Wallet } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, qs } from '@/services/api';
import { useRegions } from '@/hooks';
import { catName, date, money } from '@/utils/format';
import { Card, ErrorState, Skeleton, Tabs } from '@/components/ui';
import { PageHeader, StatCard } from '@/components/common';
import { COLORS, SellerRow } from './shared';
/* ═════════ Dashboard ═════════ */
export function AdminDashboard() {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const ov = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<Record<string, number | string>>('/analytics/admin/overview') });
  const sales = useQuery({ queryKey: ['admin', 'sales', period], queryFn: () => api.get<{ series: { date: string; revenue: number; orders: number }[]; byCategory: { slug: string; nameUz: string; nameRu: string; nameEn: string; revenue: number }[]; topSellers: { id: string; farmName: string; revenue: number; orders: number }[]; topProducts: { productId: string; name: string; revenue: number }[]; byRegion: { region: string; revenue: number; orders: number }[] }>(`/analytics/admin/sales${qs({ period, days: period === 'month' ? 365 : period === 'week' ? 120 : 30 })}`) });
  const pending = useQuery({ queryKey: ['admin', 'sellers', 'PENDING'], queryFn: () => api.page<SellerRow[]>('/admin/sellers?status=PENDING&limit=5') });
  const o = ov.data ?? {};
  const totalCat = (sales.data?.byCategory ?? []).reduce((a, b) => a + b.revenue, 0) || 1;
  return (
    <div>
      <PageHeader title={t('admin.panel')} />
      {ov.isError ? <ErrorState onRetry={() => ov.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Users className="h-5 w-5" />} label={t('admin.totalUsers')} value={o.totalUsers ?? '—'} to="/admin/users" />
          <StatCard icon={<Store className="h-5 w-5" />} label={t('admin.activeSellers')} value={o.activeSellers ?? '—'} to="/admin/users?role=SELLER" hint={o.pendingSellers ? <Link to="/admin/applications" className="font-bold text-amber-600">{o.pendingSellers} {t('admin.pendingSellers')}</Link> : undefined} tone="lime" />
          <StatCard icon={<Package className="h-5 w-5" />} label={t('admin.activeProducts')} value={o.activeProducts ?? '—'} to="/admin/reports/view/products" hint={o.pendingProducts ? <Link to="/admin/products" className="font-bold text-amber-600">{o.pendingProducts} {t('status.prod_pending_review')}</Link> : undefined} tone="blue" />
          <StatCard icon={<ShoppingBag className="h-5 w-5" />} label={t('admin.totalOrders')} value={o.totalOrders ?? '—'} tone="yellow" to="/admin/reports/view/orders?days=365" />
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t('admin.totalSales')} value={o.totalSales !== undefined ? money(o.totalSales, lang) : '—'} to="/admin/reports/view/lines?days=365" />
          <StatCard icon={<CreditCard className="h-5 w-5" />} label={t('admin.paymentVolume')} value={o.paymentVolume !== undefined ? money(o.paymentVolume, lang) : '—'} tone="blue" to="/admin/payments" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label={t('admin.commission')} value={o.commissionEarned !== undefined ? money(o.commissionEarned, lang) : '—'} tone="lime" to="/admin/wallet" />
          <StatCard icon={<MessageSquareWarning className="h-5 w-5" />} label={t('admin.openComplaints')} value={o.openComplaints ?? '—'} to="/admin/complaints" hint={o.pendingRefunds ? <Link to="/admin/payments" className="font-bold text-danger">{o.pendingRefunds} {t('admin.refunds')}</Link> : undefined} tone="red" />
        </div>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-extrabold">{t('admin.salesStats')}</h2><Tabs value={period} onChange={setPeriod} items={[{ value: 'day', label: '30d' }, { value: 'week', label: 'W' }, { value: 'month', label: 'M' }]} /></div>
          <div className="h-64">
            {sales.isLoading ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales.data?.series ?? []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEAD6" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => date(d, lang, { day: 'numeric', month: 'short' })} tick={{ fontSize: 11, fill: '#647067' }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}k`)} tick={{ fontSize: 11, fill: '#647067' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => money(v, lang)} labelFormatter={(d: string) => date(d, lang)} contentStyle={{ borderRadius: 12, border: '1px solid #EEEAD6' }} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#1F6B45" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 font-extrabold">{t('admin.byCategory')}</h2>
          <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col 2xl:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={sales.data?.byCategory ?? []} dataKey="revenue" innerRadius={42} outerRadius={70} paddingAngle={2}>{(sales.data?.byCategory ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => money(v, lang)} /></PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
              {sales.data?.byCategory.slice(0, 6).map((c, i) => <li key={c.slug} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="flex-1 truncate">{catName(c, lang)}</span><b>{Math.round((c.revenue / totalCat) * 100)}%</b></li>)}
            </ul>
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-3 font-extrabold">{t('admin.topSellers')}</h2>
          {sales.data?.topSellers.slice(0, 6).map((s, i) => <div key={s.id} className="flex items-center gap-2 border-b border-cream-100 py-2 text-sm last:border-0"><span className="w-5 text-muted">{i + 1}</span><span className="flex-1 truncate font-semibold">{s.farmName}</span><span>{money(s.revenue, lang)}</span></div>)}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-extrabold">{t('admin.topProducts')}</h2>
          {sales.data?.topProducts.slice(0, 6).map((p, i) => <div key={p.productId} className="flex items-center gap-2 border-b border-cream-100 py-2 text-sm last:border-0"><span className="w-5 text-muted">{i + 1}</span><span className="flex-1 truncate font-semibold">{p.name}</span><span>{money(p.revenue, lang)}</span></div>)}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-extrabold">{t('common.region')}</h2>
          {sales.data?.byRegion.slice(0, 6).map((r) => <div key={r.region} className="flex items-center justify-between border-b border-cream-100 py-2 text-sm last:border-0"><span className="truncate">{regionName(r.region)}</span><span>{money(r.revenue, lang)} · {r.orders}</span></div>)}
        </Card>
      </div>
      {Boolean(pending.data?.data.length) && (
        <Card className="mt-5 p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">{t('admin.pendingSellers')}</h2><Link to="/admin/applications" className="text-sm font-bold text-brand">{t('common.seeAll')}</Link></div>
          {pending.data!.data.map((s) => <div key={s.id} className="flex items-center justify-between border-b border-cream-100 py-2 text-sm last:border-0"><span className="font-semibold">{s.farmName}</span><span className="text-muted">{regionName(s.region)} · {s.tin ?? '—'}</span></div>)}
        </Card>
      )}
    </div>
  );
}

