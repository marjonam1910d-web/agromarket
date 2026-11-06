import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { SlidersHorizontal, Search, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, qs } from '@/services/api';
import { useDebounce } from '@/hooks';
import { catName, cx } from '@/utils/format';
import { Button, Checkbox, Empty, ErrorState, Input, Modal, Pagination, Select, Skeleton } from '@/components/ui';
import { CategoryIcon, ProductCard, ProductGrid, RegionDistrictSelect } from '@/components/common';
import type { Category, ProductCard as PC } from '@/types';

const KEYS = ['q', 'category', 'region', 'district', 'minPrice', 'maxPrice', 'minRating', 'inStock', 'seasonal', 'organic', 'discount', 'sort', 'page', 'seller'] as const;

export default function Catalog() {
  const { t, lang } = useI18n();
  const [sp, setSp] = useSearchParams();
  const [sheet, setSheet] = useState(false);
  const params = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ''])) as Record<(typeof KEYS)[number], string>, [sp]);
  const [q, setQ] = useState(params.q);
  const dq = useDebounce(q, 400);
  useEffect(() => {
    if (dq !== params.q) set({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  useEffect(() => {
    setQ(params.q);
  }, [params.q]);

  function set(patch: Partial<Record<(typeof KEYS)[number], string>>, keepPage = false) {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    if (!keepPage) n.delete('page');
    setSp(n, { replace: true });
  }

  const cats = useQuery({ queryKey: ['public', 'categories'], queryFn: () => api.get<Category[]>('/categories'), staleTime: 5 * 60_000 });
  const query = useQuery({
    queryKey: ['public', 'catalog', params],
    queryFn: () => api.page<PC[]>(`/products${qs({ ...params, limit: 24 })}`),
    placeholderData: keepPreviousData,
  });
  const activeCount = ['category', 'region', 'minPrice', 'maxPrice', 'minRating', 'inStock', 'seasonal', 'organic', 'discount'].filter((k) => params[k as (typeof KEYS)[number]]).length;

  const filters = (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{t('catalog.category')}</p>
        <div className="space-y-0.5">
          <button onClick={() => set({ category: '' })} className={cx('w-full rounded-lg px-3 py-2 text-left text-sm font-semibold', !params.category ? 'bg-brand-50 text-brand' : 'text-ink-soft hover:bg-cream-100')}>{t('common.all')}</button>
          {cats.data?.map((c) => (
            <div key={c.id}>
              <button onClick={() => set({ category: c.slug })} className={cx('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold', params.category === c.slug ? 'bg-brand-50 text-brand' : 'text-ink-soft hover:bg-cream-100')}>
                <CategoryIcon name={c.icon} className="h-4 w-4" />
                <span className="flex-1">{catName(c, lang)}</span>
                <span className="text-xs text-muted">{c.productCount}</span>
              </button>
              {(params.category === c.slug || c.children?.some((x) => x.slug === params.category)) &&
                c.children?.map((ch) => (
                  <button key={ch.id} onClick={() => set({ category: ch.slug })} className={cx('ml-6 block w-[calc(100%-1.5rem)] rounded-lg px-3 py-1.5 text-left text-[13px]', params.category === ch.slug ? 'font-bold text-brand' : 'text-muted hover:text-ink')}>
                    {catName(ch, lang)} <span className="text-xs">({ch.productCount})</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{t('catalog.priceRange')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min={0} placeholder={t('common.from')} defaultValue={params.minPrice} onBlur={(e) => set({ minPrice: e.target.value })} aria-label="min price" />
          <Input type="number" min={0} placeholder={t('common.to')} defaultValue={params.maxPrice} onBlur={(e) => set({ maxPrice: e.target.value })} aria-label="max price" />
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{t('product.region')}</p>
        <RegionDistrictSelect labels={false} allowAllDistricts region={params.region} district={params.district || null} onChange={(r, d) => set({ region: r, district: d ?? '' })} />
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-ink">{t('catalog.minRating')}</p>
        <div className="flex gap-1.5">
          {['', '3', '4', '4.5'].map((r) => (
            <button key={r} onClick={() => set({ minRating: r })} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold ring-1', params.minRating === r ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-cream-200')}>
              {r ? `${r}★+` : t('common.all')}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        <Checkbox checked={params.inStock === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })} label={t('catalog.onlyInStock')} />
        <Checkbox checked={params.seasonal === 'true'} onChange={(e) => set({ seasonal: e.target.checked ? 'true' : '' })} label={t('catalog.onlySeasonal')} />
        <Checkbox checked={params.organic === 'true'} onChange={(e) => set({ organic: e.target.checked ? 'true' : '' })} label={t('catalog.onlyOrganic')} />
        <Checkbox checked={params.discount === 'true'} onChange={(e) => set({ discount: e.target.checked ? 'true' : '' })} label={t('catalog.onlyDiscount')} />
      </div>
      {activeCount > 0 && <Button variant="outline" block onClick={() => setSp(new URLSearchParams(params.q ? { q: params.q } : {}))}><X className="h-4 w-4" />{t('catalog.clearFilters')}</Button>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{t('catalog.title')}</h1>
          <p className="text-sm text-muted">{query.data ? t('catalog.results', { n: query.data.meta.total }) : ' '}</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
          <div className="relative w-full min-w-0 sm:w-72">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav.searchPlaceholder')} left={<Search className="h-4 w-4" />} aria-label={t('common.search')} />
          </div>
          <Select value={params.sort || 'newest'} onChange={(e) => set({ sort: e.target.value === 'newest' ? '' : e.target.value })} className="min-w-0 flex-1 sm:w-44 sm:flex-none" aria-label={t('catalog.sort')}>
            <option value="newest">{t('catalog.newest')}</option>
            <option value="price_asc">{t('catalog.priceAsc')}</option>
            <option value="price_desc">{t('catalog.priceDesc')}</option>
            <option value="rating">{t('catalog.rating')}</option>
            <option value="popular">{t('catalog.popular')}</option>
          </Select>
          <Button variant="outline" className="relative shrink-0 lg:hidden" onClick={() => setSheet(true)} aria-label={t('common.filters')}>
            <SlidersHorizontal className="h-4 w-4" />
            {activeCount > 0 && <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-brand text-[11px] leading-5 text-white">{activeCount}</span>}
          </Button>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl bg-white p-4 ring-1 ring-cream-200 no-scrollbar">{filters}</div>
        </aside>
        <div className={cx('transition-opacity', query.isFetching && query.isPlaceholderData && 'opacity-60')}>
          {query.isLoading ? (
            <ProductGrid>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</ProductGrid>
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : !query.data?.data.length ? (
            <Empty title={t('catalog.noResults')} hint={t('catalog.noResultsHint')} action={<Button variant="outline" onClick={() => setSp(new URLSearchParams())}>{t('catalog.clearFilters')}</Button>} />
          ) : (
            <>
              <ProductGrid>{query.data.data.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid>
              <Pagination page={query.data.meta.page} pages={query.data.meta.pages} onChange={(p) => { set({ page: String(p) }, true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </div>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} title={t('common.filters')} footer={<Button block onClick={() => setSheet(false)}>{t('catalog.showResults')} {query.data ? `(${query.data.meta.total})` : ''}</Button>}>
        {filters}
      </Modal>
    </div>
  );
}
