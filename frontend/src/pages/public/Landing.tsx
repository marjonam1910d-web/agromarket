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
import { CategoryIcon, FloatingLeaves, ProductCard, ProductGrid } from '@/components/common';
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

/** Hero illyustratsiyasi: qatlamli dala, quyosh, daraxtlar va savat — to'liq SVG (tashqi rasm kerak emas) */
function HeroArt() {
  const { lang } = useI18n();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 60]);
  const y2 = useTransform(scrollY, [0, 500], [0, 30]);
  const chips = [
    { e: '🍅', l: { uz: 'Pomidor', ru: 'Помидоры', en: 'Tomatoes' }[lang], c: 'left-[4%] top-[18%]', d: 0 },
    { e: '🍇', l: { uz: 'Uzum', ru: 'Виноград', en: 'Grapes' }[lang], c: 'right-[6%] top-[10%]', d: 1.2 },
    { e: '🍯', l: { uz: 'Asal', ru: 'Мёд', en: 'Honey' }[lang], c: 'right-[2%] bottom-[30%]', d: 2.1 },
    { e: '🥛', l: { uz: 'Sut', ru: 'Молоко', en: 'Milk' }[lang], c: 'left-[8%] bottom-[22%]', d: 0.6 },
  ];
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[560px]">
      <motion.svg style={{ y: y1 }} viewBox="0 0 560 448" className="absolute inset-0 h-full w-full drop-shadow-2xl" aria-hidden>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF6DD" /><stop offset="1" stopColor="#E8F3D8" /></linearGradient>
          <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8BC34A" /><stop offset="1" stopColor="#4C9A6C" /></linearGradient>
          <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4C9A6C" /><stop offset="1" stopColor="#1F6B45" /></linearGradient>
          <clipPath id="frame"><rect x="0" y="0" width="560" height="448" rx="36" /></clipPath>
        </defs>
        <g clipPath="url(#frame)">
          <rect width="560" height="448" fill="url(#sky)" />
          <motion.circle cx="420" cy="110" r="54" fill="#F2C14E" style={{ transformOrigin: '420px 110px', transformBox: 'view-box' }} animate={{ scale: [0.96, 1.07, 0.96] }} transition={{ duration: 6, repeat: Infinity }} />
          <circle cx="420" cy="110" r="90" fill="#F2C14E" opacity=".18" />
          <path d="M0 250 C 120 200, 220 230, 300 210 S 480 170, 560 200 L560 448 L0 448Z" fill="url(#h1)" opacity=".75" />
          <path d="M0 300 C 140 260, 260 300, 380 270 S 520 250, 560 262 L560 448 L0 448Z" fill="url(#h2)" />
          {Array.from({ length: 12 }).map((_, i) => (
            <path key={i} d={`M${280 + (i - 6) * 10} 300 Q ${280 + (i - 6) * 40} 380 ${280 + (i - 6) * 80} 448`} stroke="#123B2A" strokeOpacity=".22" strokeWidth="2" fill="none" />
          ))}
          {[[90, 222], [130, 232], [470, 196]].map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 3} y={y} width="6" height="26" fill="#6B4F2A" />
              <circle cx={x} cy={y - 6} r="20" fill="#1F6B45" />
              <circle cx={x - 9} cy={y + 2} r="12" fill="#2E7D52" />
            </g>
          ))}
          {/* traktor */}
          <motion.g animate={{ x: [0, 40, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}>
            <rect x="200" y="214" width="40" height="18" rx="4" fill="#DC2626" />
            <rect x="226" y="202" width="16" height="14" rx="2" fill="#B91C1C" />
            <circle cx="208" cy="236" r="9" fill="#18251C" /><circle cx="236" cy="238" r="6" fill="#18251C" />
          </motion.g>
        </g>
      </motion.svg>
      {/* savat */}
      <motion.div style={{ y: y2 }} className="absolute bottom-[6%] left-[38%] w-[50%]">
        <svg viewBox="0 0 300 190" className="w-full drop-shadow-[0_20px_30px_rgba(18,59,42,.35)]" aria-hidden>
          <text x="58" y="88" fontSize="64">🥬</text><text x="112" y="78" fontSize="70">🍅</text><text x="176" y="88" fontSize="62">🫑</text>
          <text x="86" y="102" fontSize="54">🥕</text><text x="150" y="104" fontSize="54">🍆</text>
          <path d="M20 96 H280 L252 180 H48 Z" fill="#B7793C" />
          {Array.from({ length: 5 }).map((_, i) => <path key={i} d={`M${30 + i * 4} ${110 + i * 14} H${270 - i * 4}`} stroke="#8A5524" strokeWidth="3" />)}
          <path d="M20 96 H280" stroke="#8A5524" strokeWidth="8" strokeLinecap="round" />
        </svg>
      </motion.div>
      {chips.map((c) => (
        <motion.div key={c.l} className={cx('absolute flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-bold text-ink shadow-card backdrop-blur', c.c)} animate={{ y: [0, -10, 0] }} transition={{ duration: 5, delay: c.d, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="text-xl">{c.e}</span>
          {c.l}
        </motion.div>
      ))}
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
  const farmers = useQuery({ queryKey: ['public', 'farmers', 'top'], queryFn: () => api.get<{ id: string; farmName: string; slug: string; region: string; district: string; ratingAvg: string; ratingCount: number; productCount: number; logoUrl: string | null }[]>('/sellers?limit=4') });
  const reviews = useQuery({ queryKey: ['public', 'reviews', 'latest'], queryFn: () => api.get<{ id: string; rating: number; text: string; buyer: { name: string }; product: { name: string; slug: string }; seller: { farmName: string } }[]>('/reviews/latest') });
  const [faq, setFaq] = useState<number | null>(0);

  return (
    <div className="overflow-x-clip">
      {/* ═══ HERO ═══ */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(139,195,74,.22),transparent_45%),radial-gradient(circle_at_10%_80%,rgba(242,193,78,.16),transparent_40%)]" />
        <FloatingLeaves count={10} />
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
            <HeroArt />
          </motion.div>
        </div>
      </section>

      {/* ═══ KATEGORIYALAR ═══ */}
      <Section title={t('landing.categories')} sub={t('landing.categoriesSub')} link="/catalog" className="!pt-4">
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-6 xl:grid-cols-11">
          {(cats.data ?? Array.from({ length: 8 }).map(() => null)).map((c, i) =>
            c ? (
              <Reveal key={c.id} delay={i * 0.03} className="shrink-0">
                <Link to={`/catalog?category=${c.slug}`} className="group flex w-24 flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-soft ring-1 ring-cream-200 transition hover:-translate-y-1 hover:shadow-card sm:w-auto">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-lime-50 text-brand transition group-hover:scale-110">
                    <CategoryIcon name={c.icon} className="h-6 w-6" />
                  </span>
                  <span className="line-clamp-2 text-xs font-bold text-ink">{catName(c, lang)}</span>
                  <span className="text-[10px] text-muted">{c.productCount}</span>
                </Link>
              </Reveal>
            ) : (
              <Skeleton key={i} className="h-28 w-24 shrink-0 sm:w-auto" />
            ),
          )}
        </div>
      </Section>

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
                <div className="relative h-24 bg-gradient-to-br from-brand to-brand-800">
                  <svg viewBox="0 0 200 60" className="absolute bottom-0 w-full opacity-30" aria-hidden><path d="M0 40 Q 50 10 100 35 T 200 30 V60 H0Z" fill="#8BC34A" /></svg>
                </div>
                <div className="-mt-8 px-4 pb-4">
                  <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-lime-50 text-2xl shadow">
                    {f.logoUrl ? <img src={img(f.logoUrl)} alt="" className="h-full w-full object-cover" /> : '👨‍🌾'}
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
            <FloatingLeaves count={6} />
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
