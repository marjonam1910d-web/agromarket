import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Package, Search, Star, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { FarmPointsSection } from '@/pages/maps/Maps';
import { api, img, qs } from '@/services/api';
import { useDebounce, useRegions } from '@/hooks';
import { date, money } from '@/utils/format';
import { Badge, Card, Empty, ErrorState, Input, Pagination, Select, Skeleton, Stars } from '@/components/ui';
import { ProductCard, ProductGrid } from '@/components/common';
import type { ProductCard as PC } from '@/types';

type Farmer = { id: string; farmName: string; slug: string; description: string | null; region: string; district: string; logoUrl: string | null; coverUrl: string | null; ratingAvg: string; ratingCount: number; productCount: number; createdAt: string };

export function FarmersPage() {
  const { t, lang } = useI18n();
  const { regions, regionName } = useRegions();
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const list = useQuery({ queryKey: ['public', 'farmers', dq, region, sort, page], queryFn: () => api.page<Farmer[]>(`/sellers${qs({ q: dq, region, sort, page })}`), placeholderData: keepPreviousData });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{t('farmers.title')}</h1>
      <p className="text-sm text-muted">{t('farmers.sub')}</p>
      <div className="my-5 grid gap-2 sm:grid-cols-[1fr_220px_180px]">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t('common.search')} left={<Search className="h-4 w-4" />} aria-label={t('common.search')} />
        <Select value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }} aria-label={t('common.region')}>
          <option value="">{t('common.all')}</option>
          {regions.map((r) => <option key={r.code} value={r.code}>{r[lang]}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('catalog.sort')}>
          <option value="rating">{t('catalog.rating')}</option>
          <option value="products">{t('seller.products')}</option>
          <option value="newest">{t('catalog.newest')}</option>
        </Select>
      </div>
      {list.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : !list.data?.data.length ? <Empty title={t('catalog.noResults')} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.data.map((f) => (
              <Link key={f.id} to={`/farmers/${f.slug}`} className="group flex gap-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200 transition hover:-translate-y-0.5 hover:shadow-card">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-lime-50 text-2xl">{f.logoUrl ? <img src={img(f.logoUrl)} alt="" className="h-full w-full object-cover" /> : '👨‍🌾'}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-bold text-ink group-hover:text-brand"><span className="truncate">{f.farmName}</span><BadgeCheck className="h-4 w-4 shrink-0 text-brand" /></p>
                  <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" />{regionName(f.region)}, {f.district}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{f.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs"><span className="flex items-center gap-1"><Stars value={f.ratingAvg} size={11} />({f.ratingCount})</span><span className="font-semibold text-brand">{t('farmers.products', { n: f.productCount })}</span></div>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} pages={list.data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

type FarmerDetail = Farmer & {
  products: PC[];
  reviews: { id: string; rating: number; text: string | null; createdAt: string; product: { name: string }; buyer: { name: string } }[];
  stats: { deliveredOrders: number; productCount: number };
  deliveryZones: { region: string; district: string | null; baseFee: string; freeFromAmount: string | null; minDays: number; maxDays: number }[];
};

export function FarmerDetailPage() {
  const { slug = '' } = useParams();
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['public', 'farmer', slug], queryFn: () => api.get<FarmerDetail>(`/sellers/${slug}`) });
  if (q.isLoading) return <div className="mx-auto max-w-7xl px-4 py-8"><Skeleton className="h-56" /></div>;
  if (!q.data) return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title={t('common.empty')} /></div>;
  const f = q.data;
  return (
    <div>
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-brand to-brand-900 sm:h-56">
        {f.coverUrl && <img src={img(f.coverUrl)} alt="" className="h-full w-full object-cover opacity-60" />}
        <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute bottom-0 h-16 w-full" aria-hidden><path d="M0 40 Q 100 0 200 30 T 400 25 V60 H0Z" fill="#F7F5EA" /></svg>
      </div>
      <div className="mx-auto -mt-16 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <span className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border-4 border-cream bg-lime-50 text-5xl shadow-card">{f.logoUrl ? <img src={img(f.logoUrl)} alt="" className="h-full w-full object-cover" /> : '👨‍🌾'}</span>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold text-ink sm:text-3xl">{f.farmName}<BadgeCheck className="h-6 w-6 text-brand" /></h1>
            <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-4 w-4" />{regionName(f.region)}, {f.district} · {t('farmers.since', { year: new Date(f.createdAt).getFullYear() })}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-lg">
          <Card className="p-3 text-center"><Star className="mx-auto h-5 w-5 fill-sun text-sun" /><p className="font-extrabold">{Number(f.ratingAvg).toFixed(1)}</p><p className="text-[11px] text-muted">{f.ratingCount} {t('common.reviews')}</p></Card>
          <Card className="p-3 text-center"><Package className="mx-auto h-5 w-5 text-brand" /><p className="font-extrabold">{f.stats.productCount}</p><p className="text-[11px] text-muted">{t('seller.products')}</p></Card>
          <Card className="p-3 text-center"><Truck className="mx-auto h-5 w-5 text-brand" /><p className="font-extrabold">{f.stats.deliveredOrders}</p><p className="text-[11px] text-muted">{t('farmers.deliveredOrders')}</p></Card>
        </div>
        {f.description && <p className="mt-5 max-w-3xl whitespace-pre-line text-ink-soft">{f.description}</p>}
        <h2 className="mb-4 mt-10 text-xl font-extrabold text-ink">{t('seller.products')}</h2>
        {f.products.length ? <ProductGrid>{f.products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid> : <Empty title={t('common.empty')} />}
        <FarmPointsSection sellerId={f.id} />
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 font-extrabold text-ink">{t('farmers.deliversTo')}</h3>
            <div className="flex flex-wrap gap-2">
              {f.deliveryZones.map((z) => <Badge key={z.region + z.district} tone="green">{regionName(z.region)}{z.district ? ` · ${z.district}` : ''} · {money(z.baseFee, lang)}</Badge>)}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-extrabold text-ink">{t('product.reviews')}</h3>
            {f.reviews.length ? f.reviews.map((r) => (
              <div key={r.id} className="border-b border-cream-200 py-3 last:border-0">
                <div className="flex justify-between text-sm"><b>{r.buyer.name}</b><span className="text-xs text-muted">{date(r.createdAt, lang)}</span></div>
                <Stars value={r.rating} size={12} />
                <p className="text-sm text-ink-soft">{r.text}</p>
                <p className="text-xs text-muted">{r.product.name}</p>
              </div>
            )) : <p className="text-sm text-muted">{t('product.noReviews')}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
