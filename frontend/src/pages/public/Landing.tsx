import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform, animate } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BadgeCheck, ChevronDown, CreditCard, Leaf, MapPin, PackageCheck, Quote, Search, ShieldCheck, ShoppingBasket, Sprout, Star, Store, Truck, Users, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useRegions } from '@/hooks';
import { catName, cx } from '@/utils/format';
import { Button, Skeleton, Stars } from '@/components/ui';
import { CategoryIcon, ProductCard, ProductGrid } from '@/components/common';
import type { Category, ProductCard as PC } from '@/types';

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
      {children}
    </motion.div>
  );
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{new Intl.NumberFormat('ru-RU').format(v).replace(/ /g, ' ')}</span>;
}

function Section({ title, sub, link, children, className }: { title: string; sub?: string; link?: string; children: React.ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <section className={cx('mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16', className)}>
      <Reveal className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted sm:text-base">{sub}</p>}
        </div>
        {link && (
          <Link to={link} className="group hidden shrink-0 items-center gap-1 text-sm font-bold text-brand sm:flex">
            {t('common.seeAll')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        )}
      </Reveal>
      {children}
    </section>
  );
}

function useProducts(params: Record<string, unknown>) {
  return useQuery({ queryKey: ['public', 'products', params], queryFn: () => api.get<PC[]>(`/products${qs(params)}`), staleTime: 60_000 });
}

function ProductRow({ params }: { params: Record<string, unknown> }) {
  const q = useProducts({ limit: 8, ...params });
  if (q.isLoading) return <ProductGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</ProductGrid>;
  if (!q.data?.length) return null;
  return <ProductGrid>{q.data.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid>;
}

/** Unsplash rasmi (bepul litsenziya). Yuklanmasa — neytral fon qoladi, multfilm emas */
const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=72`;
const HERO_MAIN = '1545830790-68595959c491'; // fermer savatlar bilan
const HERO_SIDE = '1560493676-04071c5f467b'; // quyosh botishidagi ekinzor
const MAP_PHOTO = '1515276427842-f85802d514a2'; // bug'doy dalasi

function Photo({ id, w, alt, className, eager }: { id: string; w?: number; alt: string; className?: string; eager?: boolean }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cx('relative overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900', className)}>
      {ok && (
        <img
          src={photo(id, w)}
          srcSet={`${photo(id, Math.round((w ?? 1200) / 2))} ${Math.round((w ?? 1200) / 2)}w, ${photo(id, w)} ${w ?? 1200}w`}
          sizes="(max-width: 1024px) 100vw, 50vw"
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          data-fallback="1"
          onError={() => setOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** Hero: haqiqiy fotosuratlar kompozitsiyasi */
function HeroPhotos({ farmers, products }: { farmers?: number; products?: number }) {
  const { t } = useI18n();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 40]);
  const y2 = useTransform(scrollY, [0, 500], [0, -24]);
  return (
    <div className="relative mx-auto w-full max-w-[580px] pb-10 pl-0 sm:pl-10">
      <motion.div style={{ y: y1 }}>
        <Photo id={HERO_MAIN} w={1100} eager alt={t('y.home.realFarms')} className="aspect-[4/5] rounded-[28px] shadow-[0_30px_60px_-25px_rgba(18,59,42,.55)] ring-1 ring-black/5 sm:aspect-[5/6]" />
      </motion.div>
      <motion.div style={{ y: y2 }} className="absolute -bottom-2 left-0 hidden w-[44%] sm:block">
        <Photo id={HERO_SIDE} w={600} alt="" className="aspect-[4/5] rounded-3xl border-[6px] border-cream shadow-card" />
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="absolute right-3 top-5 flex items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-card backdrop-blur sm:-right-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><BadgeCheck className="h-5 w-5" /></span>
        <span className="leading-tight"><b className="block text-sm text-ink">{t('y.home.verified')}</b><span className="text-[11px] text-muted">{t('y.home.direct')}</span></span>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="absolute bottom-16 right-3 rounded-2xl bg-brand-900/90 px-4 py-3 text-white shadow-card backdrop-blur sm:-right-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-lime">{t('y.home.fresh')}</p>
        <p className="mt-0.5 text-sm font-bold">{farmers ?? '—'}+ {t('landing.statFarmers').toLowerCase()} · {products ?? '—'}+ {t('landing.statProducts').toLowerCase()}</p>
      </motion.div>
      <span className="absolute bottom-3 right-4 text-[10px] text-ink/40">{t('y.home.heroCredit')}</span>
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const { regions } = useRegions();
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('namangan');
  const stats = useQuery({ queryKey: ['public', 'stats'], queryFn: () => api.get<{ farmers: number; products: number; buyers: number; deliveredOrders: number; regions: number }>('/analytics/public/stats') });
  const cats = useQuery({ queryKey: ['public', 'categories'], queryFn: () => api.get<Category[]>('/categories'), staleTime: 5 * 60_000 });
  const farmers = useQuery({ queryKey: ['public', 'farmers', 'top'], queryFn: () => api.get<{ id: string; farmName: string; slug: string; region: string; district: string; ratingAvg: string; ratingCount: number; productCount: number; logoUrl: string | null; coverUrl: string | null }[]>('/sellers?limit=4') });
  const reviews = useQuery({ queryKey: ['public', 'reviews', 'latest'], queryFn: () => api.get<{ id: string; rating: number; text: string; buyer: { name: string }; product: { name: string; slug: string }; seller: { farmName: string } }[]>('/reviews/latest') });
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="overflow-x-clip">
      {/* ═══ HERO ═══ */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(139,195,74,.16),transparent_45%),radial-gradient(circle_at_5%_85%,rgba(242,193,78,.12),transparent_40%)]" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-10 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-16">
          <div className="min-w-0">
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand shadow-sm ring-1 ring-brand-100">
              <Sprout className="h-4 w-4" /> {t('landing.heroBadge')}
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }} className="mt-5 break-words text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-[40px] text-brand-800 sm:text-5xl lg:text-[58px]">
              {t('landing.heroTitle1')}{' '}
              <span className="relative whitespace-nowrap font-display italic text-brand">
                {t('landing.heroTitle2').split(' ')[0]}
                <svg viewBox="0 0 200 12" className="absolute -bottom-1 left-0 w-full" aria-hidden><motion.path d="M2 9 C 50 2, 150 2, 198 8" stroke="#F2C14E" strokeWidth="5" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.8, duration: 0.9 }} /></svg>
              </span>{' '}
              {t('landing.heroTitle2').split(' ').slice(1).join(' ')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-5 max-w-xl text-base text-muted sm:text-lg">{t('landing.heroSubtitle')}</motion.p>
            <motion.form
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onSubmit={(e) => { e.preventDefault(); nav(`/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`); }}
              className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-card ring-1 ring-cream-200"
              role="search"
            >
              <Search className="ml-2 h-5 w-5 shrink-0 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nav.searchPlaceholder')} className="h-11 min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" aria-label={t('common.search')} />
              <Button type="submit" className="shrink-0">{t('common.search')}</Button>
            </motion.form>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-6 flex flex-wrap gap-3">
              <Link to="/catalog"><Button size="lg">{t('landing.ctaProducts')} <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/auth?mode=signup&role=SELLER"><Button size="lg" variant="accent"><Sprout className="h-4 w-4" />{t('landing.ctaFarmer')}</Button></Link>
              <a href="#how"><Button size="lg" variant="ghost">{t('landing.ctaHow')}</Button></a>
            </motion.div>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { v: stats.data?.farmers, l: t('landing.statFarmers'), i: Users },
                { v: stats.data?.products, l: t('landing.statProducts'), i: ShoppingBasket },
                { v: stats.data?.deliveredOrders, l: t('landing.statOrders'), i: PackageCheck },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/70 p-3 ring-1 ring-cream-200 backdrop-blur">
                  <s.i className="mb-1 h-5 w-5 text-brand" />
                  <p className="text-xl font-extrabold text-brand-800">{s.v !== undefined ? <Counter to={s.v} /> : '—'}+</p>
                  <p className="text-[11px] font-semibold leading-tight text-muted">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.2 }}>
            <HeroPhotos farmers={stats.data?.farmers} products={stats.data?.products} />
          </motion.div>
        </div>
      </section>

      {/* ═══ KATEGORIYALAR ═══ */}
      <Section title={t('landing.categories')} sub={t('landing.categoriesSub')} link="/catalog" className="!pt-4">
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4 xl:grid-cols-6">
          {(cats.data ?? Array.from({ length: 6 }).map(() => null)).map((c, i) =>
            c ? (
              <Reveal key={c.id} delay={i * 0.03} className="w-36 shrink-0 snap-start sm:w-auto">
                <Link to={`/catalog?category=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 shadow-soft ring-1 ring-black/5 transition hover:-translate-y-1 hover:shadow-card">
                  <CategoryIcon name={c.icon} className="absolute left-1/2 top-[38%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-white/30" />
                  {c.imageUrl && <img src={img(c.imageUrl)} alt={catName(c, lang)} loading="lazy" decoding="async" data-fallback="1" onError={(e) => (e.currentTarget.style.display = 'none')} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-3">
                    <span className="line-clamp-2 text-sm font-extrabold leading-tight text-white">{catName(c, lang)}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-white/75">{t('farmers.products', { n: c.productCount ?? 0 })}</span>
                  </span>
                </Link>
              </Reveal>
            ) : (
              <Skeleton key={i} className="aspect-[4/5] w-36 shrink-0 sm:w-auto" />
            ),
          )}
        </div>
      </Section>

      {/* ═══ XARITA ═══ */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <Reveal>
          <Link to="/map" className="group relative flex min-h-[220px] items-end overflow-hidden rounded-3xl bg-brand-900 sm:min-h-[260px]">
            <Photo id={MAP_PHOTO} w={1600} alt={t('y.home.realFarms')} className="!absolute inset-0 transition duration-700 group-hover:scale-[1.03]" />
            <span className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-900/70 to-transparent" />
            <div className="relative max-w-xl p-6 sm:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-xs font-extrabold text-brand-900"><MapPin className="h-3.5 w-3.5" />{t('y.nav.map')}</span>
              <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">{t('y.home.realFarms')}</h2>
              <p className="mt-2 text-sm text-white/80 sm:text-base">{t('y.home.mapText')}</p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-800 transition group-hover:gap-3">{t('y.home.seeMap')} <ArrowRight className="h-4 w-4" /></span>
            </div>
          </Link>
        </Reveal>
      </section>

      {/* ═══ MAVSUMIY ═══ */}
      <div className="bg-gradient-to-b from-transparent via-lime-50/60 to-transparent">
        <Section title={t('landing.seasonal')} sub={t('landing.seasonalSub')} link="/catalog?seasonal=true">
          <ProductRow params={{ seasonal: 'true', sort: 'popular' }} />
        </Section>
      </div>

      {/* ═══ TAVSIYA ═══ */}
      <Section title={t('landing.featured')} sub={t('landing.featuredSub')} link="/catalog?sort=rating">
        <ProductRow params={{ sort: 'rating', inStock: 'true' }} />
      </Section>

      {/* ═══ FERMERLAR ═══ */}
      <Section title={t('landing.farmers')} sub={t('landing.farmersSub')} link="/farmers">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(farmers.data ?? []).map((f, i) => (
            <Reveal key={f.id} delay={i * 0.06}>
              <Link to={`/farmers/${f.slug}`} className="group block overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-cream-200 transition hover:-translate-y-1 hover:shadow-card">
                <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-600 to-brand-900">
                  {f.coverUrl && <img src={img(f.coverUrl)} alt={f.farmName} loading="lazy" decoding="async" data-fallback="1" onError={(e) => (e.currentTarget.style.display = 'none')} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                <div className="-mt-8 px-4 pb-4">
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-lime-50 text-2xl shadow">
                    {f.logoUrl ? <img src={img(f.logoUrl)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-lg font-extrabold text-brand">{f.farmName.charAt(0)}</span>}
                  </span>
                  <p className="mt-2 flex items-center gap-1 font-bold text-ink group-hover:text-brand">{f.farmName}<BadgeCheck className="h-4 w-4 shrink-0 text-brand" /></p>
                  <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3" />{regions.find((r) => r.code === f.region)?.[lang]}, {f.district}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1"><Stars value={f.ratingAvg} size={12} />({f.ratingCount})</span>
                    <span className="font-semibold text-brand">{t('farmers.products', { n: f.productCount })}</span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ HUDUDLAR ═══ */}
      <Section title={t('landing.regional')} sub={t('landing.regionalSub')}>
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {regions.map((r) => (
            <button key={r.code} onClick={() => setRegion(r.code)} className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition', region === r.code ? 'bg-brand text-white shadow' : 'bg-white text-ink-soft ring-1 ring-cream-200 hover:bg-brand-50')}>
              {r[lang]}
            </button>
          ))}
        </div>
        <RegionProducts region={region} />
      </Section>

      {/* ═══ CHEGIRMALAR ═══ */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 text-white sm:p-10">
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="rounded-full bg-sun px-3 py-1 text-xs font-extrabold text-brand-900">−%</span>
                <h2 className="mt-3 text-2xl font-extrabold sm:text-3xl">{t('landing.deals')}</h2>
                <p className="text-white/70">{t('landing.dealsSub')}</p>
              </div>
              <Link to="/catalog?discount=true"><Button variant="accent">{t('common.seeAll')} <ArrowRight className="h-4 w-4" /></Button></Link>
            </div>
            <div className="relative mt-6 [&_article]:text-ink"><ProductRow params={{ discount: 'true', limit: 4 }} /></div>
          </div>
        </Reveal>
      </section>

      {/* ═══ QANDAY ISHLAYDI ═══ */}
      <Section title={t('landing.howTitle')} sub={t('landing.howSub')} className="scroll-mt-20">
        <div id="how" className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            [Search, 'landing.how1', 'landing.how1d'],
            [ShoppingBasket, 'landing.how2', 'landing.how2d'],
            [CreditCard, 'landing.how3', 'landing.how3d'],
            [Truck, 'landing.how4', 'landing.how4d'],
          ] as [typeof Search, TKey, TKey][]).map(([I, ti, d], i) => (
            <Reveal key={ti} delay={i * 0.1}>
              <div className="relative h-full rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200">
                <span className="absolute right-5 top-4 font-display text-5xl italic text-cream-300">0{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-glow"><I className="h-6 w-6" /></span>
                <h3 className="mt-4 text-lg font-extrabold text-ink">{t(ti)}</h3>
                <p className="mt-1 text-sm text-muted">{t(d)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ═══ AFZALLIKLAR ═══ */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2">
        {([
          { title: 'landing.farmerBenefits', items: ['landing.fb1', 'landing.fb2', 'landing.fb3', 'landing.fb4'], icons: [Wallet, Users, Store, ShieldCheck], dark: true, cta: <Link to="/auth?mode=signup&role=SELLER"><Button variant="accent">{t('nav.becomeFarmer')}</Button></Link> },
          { title: 'landing.buyerBenefits', items: ['landing.bb1', 'landing.bb2', 'landing.bb3', 'landing.bb4'], icons: [Leaf, BadgeCheck, Truck, ShieldCheck], dark: false, cta: <Link to="/catalog"><Button>{t('landing.ctaProducts')}</Button></Link> },
        ] as { title: TKey; items: TKey[]; icons: (typeof Leaf)[]; dark: boolean; cta: React.ReactNode }[]).map((b, bi) => (
          <Reveal key={b.title} delay={bi * 0.1}>
            <div className={cx('h-full rounded-3xl p-6 sm:p-8', b.dark ? 'bg-brand-800 text-white' : 'bg-white ring-1 ring-cream-200')}>
              <h3 className={cx('text-2xl font-extrabold', b.dark ? 'text-white' : 'text-ink')}>{t(b.title)}</h3>
              <ul className="mt-5 space-y-3">
                {b.items.map((k, i) => {
                  const I = b.icons[i];
                  return (
                    <li key={k} className="flex items-start gap-3">
                      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', b.dark ? 'bg-white/10 text-lime' : 'bg-brand-50 text-brand')}><I className="h-5 w-5" /></span>
                      <span className={cx('pt-1.5 text-[15px] font-semibold', b.dark ? 'text-white/90' : 'text-ink-soft')}>{t(k)}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6">{b.cta}</div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ═══ STATISTIKA ═══ */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-4 rounded-3xl bg-gradient-to-r from-lime-50 via-white to-sun-100 p-6 ring-1 ring-cream-200 sm:grid-cols-5 sm:p-8">
          {[
            [stats.data?.farmers, 'landing.statFarmers'],
            [stats.data?.products, 'landing.statProducts'],
            [stats.data?.buyers, 'landing.statBuyers'],
            [stats.data?.deliveredOrders, 'landing.statOrders'],
            [stats.data?.regions, 'landing.statRegions'],
          ].map(([v, l]) => (
            <div key={l as string} className="text-center">
              <p className="text-3xl font-extrabold text-brand-800 sm:text-4xl">{v !== undefined ? <Counter to={v as number} /> : '—'}</p>
              <p className="mt-1 text-xs font-semibold text-muted sm:text-sm">{t(l as TKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ MIJOZLAR FIKRI (haqiqiy sharhlar) ═══ */}
      {Boolean(reviews.data?.length) && (
        <Section title={t('landing.testimonials')}>
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.data!.slice(0, 3).map((r, i) => (
              <Reveal key={r.id} delay={i * 0.08}>
                <figure className="h-full rounded-2xl bg-white p-6 shadow-soft ring-1 ring-cream-200">
                  <Quote className="h-7 w-7 text-lime" />
                  <blockquote className="mt-3 text-[15px] text-ink-soft">“{r.text}”</blockquote>
                  <figcaption className="mt-4 flex items-center justify-between text-sm">
                    <span><span className="font-bold text-ink">{r.buyer.name}</span><br /><Link to={`/product/${r.product.slug}`} className="text-xs text-muted hover:text-brand">{r.product.name} · {r.seller.farmName}</Link></span>
                    <span className="flex items-center gap-1 font-bold text-ink"><Star className="h-4 w-4 fill-sun text-sun" />{r.rating}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ═══ FAQ ═══ */}
      <Section title={t('landing.faqTitle')}>
        <div className="mx-auto max-w-3xl divide-y divide-cream-200 rounded-2xl bg-white ring-1 ring-cream-200">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <div key={n}>
              <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold text-ink" onClick={() => setFaq(faq === n ? null : n)} aria-expanded={faq === n}>
                {t(`landing.q${n}` as TKey)}
                <ChevronDown className={cx('h-5 w-5 shrink-0 text-brand transition', faq === n && 'rotate-180')} />
              </button>
              <motion.div initial={false} animate={{ height: faq === n ? 'auto' : 0, opacity: faq === n ? 1 : 0 }} className="overflow-hidden">
                <p className="px-5 pb-5 text-sm text-muted">{t(`landing.a${n}` as TKey)}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </Section>

      {/* ═══ CTA ═══ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-sun px-6 py-10 text-center sm:px-10">
            <Sprout className="mx-auto h-10 w-10 text-brand-800" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold text-brand-900 sm:text-3xl">{t('landing.ctaTitle')}</h2>
            <p className="mt-2 text-brand-800/80">{t('landing.ctaText')}</p>
            <Link to="/auth?mode=signup&role=SELLER" className="mt-6 inline-block"><Button variant="dark" size="lg">{t('landing.ctaFarmer')} <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function RegionProducts({ region }: { region: string }) {
  const { t } = useI18n();
  const q = useProducts({ region, limit: 4, sort: 'popular' });
  if (q.isLoading) return <ProductGrid>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</ProductGrid>;
  if (!q.data?.length) return <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted ring-1 ring-cream-200">{t('catalog.noResults')}</p>;
  return <ProductGrid>{q.data.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid>;
}
