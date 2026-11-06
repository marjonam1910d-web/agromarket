import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ClipboardList, Package, PackageX, Plus, Star, TrendingUp, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { date, money, num } from '@/utils/format';
import { Button, Card, ErrorState, Skeleton, Tabs } from '@/components/ui';
import { PageHeader, StatCard, StatusBadge } from '@/components/common';
import { VerificationBanner, SellerOrderRow, SellerOrdersTable } from './shared';
/* ═════════ Dashboard ═════════ */
type Overview = {
  cards: { totalSales: string; revenue: string; deliveredOrders: number; totalOrders: number; newOrders: number; activeProducts: number; outOfStockProducts: number; averageRating: string; ratingCount: number };
  orderStatuses: Record<string, number>;
  stockAlerts: { id: string; name: string; quantity: string; unit: string; threshold: string }[];
};

export function SellerDashboard() {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const ov = useQuery({ queryKey: ['seller', 'overview'], queryFn: () => api.get<Overview>('/analytics/seller/overview') });
  const sales = useQuery({ queryKey: ['seller', 'sales', period], queryFn: () => api.get<{ series: { date: string; revenue: number; orders: number }[]; bestSellers: { productId: string; name: string; qty: number; revenue: number; unit: string }[] }>(`/analytics/seller/sales${qs({ period, days: period === 'month' ? 365 : period === 'week' ? 120 : 30 })}`) });
  const recent = useQuery({ queryKey: ['seller-orders', 'recent'], queryFn: () => api.page<SellerOrderRow[]>('/orders/seller/list?limit=5') });
  const c = ov.data?.cards;
  return (
    <div>
      <VerificationBanner />
      <PageHeader title={t('seller.panel')} actions={<Link to="/seller/products/new"><Button><Plus className="h-4 w-4" />{t('seller.addProduct')}</Button></Link>} />
      {ov.isError ? <ErrorState onRetry={() => ov.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
          <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t('seller.totalSales')} value={c ? money(c.totalSales, lang) : '—'} />
          <StatCard icon={<ClipboardList className="h-5 w-5" />} label={t('seller.totalOrders')} value={c?.totalOrders ?? '—'} hint={c?.newOrders ? <Link to="/seller/orders?status=pending" className="font-bold text-brand">+{c.newOrders} {t('seller.newOrders')}</Link> : undefined} tone="blue" />
          <StatCard icon={<Wallet className="h-5 w-5" />} label={t('seller.revenue')} value={c ? money(c.revenue, lang) : '—'} tone="lime" />
          <StatCard icon={<Package className="h-5 w-5" />} label={t('seller.activeProducts')} value={c?.activeProducts ?? '—'} />
          <StatCard icon={<PackageX className="h-5 w-5" />} label={t('seller.outOfStock')} value={c?.outOfStockProducts ?? '—'} tone="red" />
          <StatCard icon={<Star className="h-5 w-5" />} label={t('seller.avgRating')} value={c ? Number(c.averageRating).toFixed(1) : '—'} hint={c ? `${c.ratingCount} ${t('common.reviews')}` : undefined} tone="yellow" />
        </div>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-extrabold">{t('seller.salesDynamics')}</h2>
            <Tabs value={period} onChange={setPeriod} items={[{ value: 'day', label: '30d' }, { value: 'week', label: 'W' }, { value: 'month', label: 'M' }]} />
          </div>
          <div className="h-64">
            {sales.isLoading ? <Skeleton className="h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sales.data?.series ?? []} margin={{ left: -10, right: 8 }}>
                  <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1F6B45" stopOpacity={0.35} /><stop offset="1" stopColor="#1F6B45" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEEAD6" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(d: string) => date(d, lang, { day: 'numeric', month: 'short' })} tick={{ fontSize: 11, fill: '#647067' }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))} tick={{ fontSize: 11, fill: '#647067' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => money(v, lang)} labelFormatter={(d: string) => date(d, lang)} contentStyle={{ borderRadius: 12, border: '1px solid #EEEAD6' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#1F6B45" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-extrabold">{t('seller.bestSellers')}</h2>
          <ul className="space-y-3">
            {sales.data?.bestSellers.slice(0, 6).map((b, i) => (
              <li key={b.productId} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{b.name}</span>
                <span className="text-muted">{num(b.qty)} {t(`units.${b.unit}` as TKey)}</span>
              </li>
            ))}
            {!sales.data?.bestSellers.length && <p className="text-sm text-muted">{t('common.empty')}</p>}
          </ul>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">{t('seller.recentOrders')}</h2><Link to="/seller/orders" className="text-sm font-bold text-brand">{t('common.seeAll')}</Link></div>
          <SellerOrdersTable rows={recent.data?.data ?? []} />
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-3 font-extrabold">{t('seller.orderStatuses')}</h2>
            <div className="space-y-2">{Object.entries(ov.data?.orderStatuses ?? {}).map(([s, n]) => <div key={s} className="flex items-center justify-between text-sm"><StatusBadge status={s} /><b>{n}</b></div>)}</div>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-extrabold"><AlertTriangle className="h-4 w-4 text-amber-600" />{t('seller.stockAlerts')}</h2>
            {ov.data?.stockAlerts.length ? ov.data.stockAlerts.map((s) => (
              <Link key={s.id} to={`/seller/products/${s.id}/edit`} className="flex justify-between border-b border-cream-100 py-2 text-sm last:border-0 hover:text-brand"><span className="truncate">{s.name}</span><b className="text-danger">{num(s.quantity)} {t(`units.${s.unit}` as TKey)}</b></Link>
            )) : <p className="text-sm text-muted">✓</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

