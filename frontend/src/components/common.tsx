import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Apple, Bean, Beef, BadgeCheck, Camera, Carrot, Drumstick, Egg, Globe, Heart, Hexagon, ImagePlus, Leaf, Loader2, MapPin, Milk, ShoppingBasket, Sprout, Sun, Wheat, X,
} from 'lucide-react';
import { useI18n, LANGS, type TKey } from '@/i18n';
import { api, img } from '@/services/api';
import { money, cx, dateTime } from '@/utils/format';
import { useAuth } from '@/store/auth';
import { useCartActions, useErrorText, useFavorites, useRegions } from '@/hooks';
import { useToast } from '@/store/toast';
import { Badge, Select, Stars, STATUS_TONE, type Tone } from './ui';
import type { ProductCard as PC } from '@/types';

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-2" aria-label="AgroMarket">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-800 shadow-sm">
        <svg viewBox="0 0 32 32" className="h-6 w-6 transition-transform duration-500 group-hover:rotate-[-8deg]">
          <path d="M16 27c0-8 0-13 8-17-1 8-3 13-8 17z" fill="#8BC34A" />
          <path d="M16 27c0-7-1-11-8-15 1 7 3 11 8 15z" fill="#C9E7A6" />
          <circle cx="16" cy="28" r="1.8" fill="#F2C14E" />
        </svg>
      </span>
      {!compact && (
        <span className={cx('text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-brand-800')}>
          Agro<span className={light ? 'text-lime' : 'text-brand'}>Market</span>
        </span>
      )}
    </Link>
  );
}

export function LanguageSwitcher({ dark }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  const { user } = useAuth();
  return (
    <div className={cx('relative inline-flex items-center rounded-xl p-0.5', dark ? 'bg-white/10' : 'bg-cream-100')} role="group" aria-label="Language">
      <Globe className={cx('ml-1.5 mr-0.5 h-3.5 w-3.5', dark ? 'text-white/70' : 'text-muted')} />
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => {
            setLang(l.code);
            if (user) void api.patch('/users/me', { locale: l.code }).catch(() => undefined);
          }}
          className={cx(
            'rounded-lg px-2 py-1 text-xs font-bold transition',
            lang === l.code ? (dark ? 'bg-white text-brand-800' : 'bg-white text-brand shadow-sm') : dark ? 'text-white/70 hover:text-white' : 'text-muted hover:text-ink',
          )}
          aria-pressed={lang === l.code}
          title={l.label}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status, kind = 'order' }: { status: string; kind?: 'order' | 'pay' | 'del' | 'prod' | 'ver' | 'c' | 'r' }) {
  const { t } = useI18n();
  const key = (kind === 'order' ? `status.${status}` : `status.${kind}_${status}`) as TKey;
  return <Badge tone={(STATUS_TONE[status] ?? 'gray') as Tone}>{t(key)}</Badge>;
}

export function Price({ value, old, unit, size = 'md' }: { value: string | number; old?: string | number | null; unit?: string; size?: 'sm' | 'md' | 'lg' }) {
  const { lang, t } = useI18n();
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={cx('font-extrabold text-ink', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-lg')}>
        {money(value, lang)}
        {unit && <span className="text-sm font-semibold text-muted">/{t(`units.${unit}` as TKey)}</span>}
      </span>
      {old && Number(old) > Number(value) && <span className="text-sm text-muted line-through">{money(old, lang, false)}</span>}
    </div>
  );
}

const ICONS: Record<string, typeof Apple> = { apple: Apple, carrot: Carrot, wheat: Wheat, bean: Bean, beef: Beef, milk: Milk, drumstick: Drumstick, egg: Egg, hexagon: Hexagon, sun: Sun, sprout: Sprout };
export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const I = (name && ICONS[name]) || Leaf;
  return <I className={className} />;
}

export function ProductCard({ p, index = 0 }: { p: PC; index?: number }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { add } = useCartActions();
  const fav = useFavorites();
  const { regionName } = useRegions();
  const [flying, setFlying] = useState(false);
  const isFav = fav.ids.has(p.id);
  const canBuy = user?.role !== 'ADMIN' && p.inStock;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.04 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-cream-200 bg-white shadow-soft transition-shadow duration-300 hover:shadow-card"
    >
      <Link to={`/product/${p.slug}`} className="relative block aspect-square overflow-hidden bg-cream-100">
        <img src={img(p.image?.thumbUrl ?? p.image?.url)} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {p.hasDiscount && <Badge tone="red">−{p.discountPercent}%</Badge>}
          {p.isSeasonal && <Badge tone="lime">{p.seasonLabel || t('common.seasonal')}</Badge>}
          {p.isOrganic && <Badge tone="green"><Leaf className="h-3 w-3" />{t('common.organic')}</Badge>}
        </div>
        {!p.inStock && <div className="absolute inset-x-0 bottom-0 bg-ink/70 py-1.5 text-center text-xs font-bold text-white">{t('common.outOfStock')}</div>}
      </Link>
      {user && user.role !== 'ADMIN' && (
        <button
          onClick={() => fav.toggle.mutate(p.id)}
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-110"
          aria-label={t('nav.favorites')}
          aria-pressed={isFav}
        >
          <Heart className={cx('h-4.5 w-4.5 transition', isFav ? 'fill-danger text-danger' : 'text-muted')} />
        </button>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <Link to={`/product/${p.slug}`} className="line-clamp-2 text-sm font-bold leading-snug text-ink hover:text-brand sm:text-[15px]">
          {p.name}
        </Link>
        <Link to={`/farmers/${p.seller.slug}`} className="flex items-center gap-1 truncate text-xs text-muted hover:text-brand">
          {p.seller.verificationStatus === 'APPROVED' && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand" />}
          <span className="truncate">{p.seller.farmName}</span>
        </Link>
        <div className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{regionName(p.region)}</span>
        </div>
        {p.ratingCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted">
            <Stars value={p.ratingAvg} size={12} /> <span>({p.ratingCount})</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <Price value={p.finalPrice} old={p.hasDiscount ? p.price : null} unit={p.unit} size="sm" />
          {canBuy && (
            <div className="relative">
              <button
                onClick={() => {
                  if (!user) {
                    location.href = `/auth?next=${encodeURIComponent(location.pathname)}`;
                    return;
                  }
                  setFlying(true);
                  setTimeout(() => setFlying(false), 650);
                  add.mutate({ productId: p.id, quantity: Math.max(1, Number(p.minOrderQty)) });
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand-600 active:scale-90"
                aria-label={t('product.addToCart')}
              >
                {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBasket className="h-4.5 w-4.5" />}
              </button>
              {flying && (
                <motion.span
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -60, scale: 0.4 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-lime text-white"
                >
                  +1
                </motion.span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function ProductGrid({ children, cols = 'default' }: { children: ReactNode; cols?: 'default' | 'wide' }) {
  return <div className={cx('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3', cols === 'wide' ? 'lg:grid-cols-4 xl:grid-cols-5' : 'lg:grid-cols-4')}>{children}</div>;
}

export function RegionDistrictSelect({ region, district, onChange, errors, allowAllDistricts, labels = true }: {
  region: string;
  district: string | null;
  onChange: (region: string, district: string | null) => void;
  errors?: { region?: string; district?: string };
  allowAllDistricts?: boolean;
  labels?: boolean;
}) {
  const { t, lang } = useI18n();
  const { regions } = useRegions();
  const r = regions.find((x) => x.code === region);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        {labels && <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t('common.region')}</span>}
        <Select value={region} onChange={(e) => onChange(e.target.value, null)} invalid={Boolean(errors?.region)} aria-label={t('common.region')}>
          <option value="">{t('common.selectRegion')}</option>
          {regions.map((x) => <option key={x.code} value={x.code}>{x[lang]}</option>)}
        </Select>
        {errors?.region && <span className="mt-1 block text-xs text-danger">{errors.region}</span>}
      </label>
      <label className="block">
        {labels && <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{t('common.district')}</span>}
        <Select value={district ?? ''} onChange={(e) => onChange(region, e.target.value || null)} disabled={!r} invalid={Boolean(errors?.district)} aria-label={t('common.district')}>
          <option value="">{allowAllDistricts ? t('seller.zoneAll') : t('common.selectDistrict')}</option>
          {r?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </Select>
        {errors?.district && <span className="mt-1 block text-xs text-danger">{errors.district}</span>}
      </label>
    </div>
  );
}

/** Rasm yuklash: galereya + kamera (mobil), oldindan ko'rish, tartibni saqlash */
export function ImageUploader({ value, onChange, folder = 'products', max = 8 }: { value: { url: string; thumbUrl?: string | null }[]; onChange: (v: { url: string; thumbUrl?: string | null }[]) => void; folder?: string; max?: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const [busy, setBusy] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, max - value.length);
    if (list.some((f) => f.size > 5 * 1024 * 1024)) return toast('5 MB', 'error');
    const form = new FormData();
    list.forEach((f) => form.append('files', f));
    setBusy(true);
    try {
      const res = await api.upload<{ url: string; thumbUrl: string }[]>(`/uploads/images?folder=${folder}`, form);
      onChange([...value, ...res]);
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((im, i) => (
          <div key={im.url} className="group relative aspect-square overflow-hidden rounded-xl border border-cream-200 bg-cream-100">
            <img src={img(im.thumbUrl ?? im.url)} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded-md bg-brand px-1.5 text-[10px] font-bold text-white">1</span>}
            <button type="button" onClick={() => onChange(value.filter((x) => x.url !== im.url))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-danger shadow" aria-label={t('common.delete')}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <>
            <button type="button" onClick={() => gallery.current?.click()} disabled={busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 text-brand transition hover:bg-brand-50">
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              <span className="text-[11px] font-semibold">{t('common.add')}</span>
            </button>
            <button type="button" onClick={() => camera.current?.click()} disabled={busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-cream-300 text-muted transition hover:bg-cream-100 sm:hidden">
              <Camera className="h-6 w-6" />
              <span className="text-[11px] font-semibold">{t('common.camera')}</span>
            </button>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{t('seller.imagesHint')}</p>
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void upload(e.target.files).finally(() => (e.target.value = ''))} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void upload(e.target.files).finally(() => (e.target.value = ''))} />
    </div>
  );
}

const FLOW = ['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered'] as const;
export function OrderTimeline({ status, history }: { status: string; history: { toStatus: string; createdAt: string; note?: string | null }[] }) {
  const { t, lang } = useI18n();
  const cancelled = status === 'cancelled' || status === 'refunded';
  const idx = FLOW.indexOf(status as (typeof FLOW)[number]);
  const when = (s: string) => history.filter((h) => h.toStatus === s).at(-1)?.createdAt;
  const steps = cancelled ? [...FLOW.filter((s) => when(s)), status] : FLOW;
  return (
    <ol className="relative space-y-0">
      {steps.map((s, i) => {
        const done = cancelled ? true : i <= idx;
        const current = cancelled ? i === steps.length - 1 : i === idx;
        const at = when(s);
        return (
          <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className={cx('absolute left-[11px] top-6 h-full w-0.5', done && (cancelled || i < idx) ? 'bg-brand' : 'bg-cream-300')} />}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.07 }}
              className={cx(
                'relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                s === 'cancelled' || s === 'refunded' ? 'border-danger bg-danger' : done ? 'border-brand bg-brand' : 'border-cream-300 bg-white',
              )}
            >
              {done && <span className="h-2 w-2 rounded-full bg-white" />}
              {current && !cancelled && <span className="absolute inset-0 animate-pulseRing rounded-full bg-brand/40" />}
            </motion.span>
            <div>
              <p className={cx('text-sm font-bold', done ? 'text-ink' : 'text-muted')}>{t(`status.${s}` as TKey)}</p>
              {at && <p className="text-xs text-muted">{dateTime(at, lang)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'green' }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: 'green' | 'lime' | 'yellow' | 'red' | 'blue' }) {
  const bg = { green: 'bg-brand-50 text-brand', lime: 'bg-lime-50 text-lime-600', yellow: 'bg-sun-100 text-amber-600', red: 'bg-red-50 text-danger', blue: 'bg-sky-50 text-sky-600' }[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-cream-200 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', bg)}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-muted">{label}</p>
          <p className="truncate text-lg font-extrabold text-ink sm:text-xl" title={typeof value === 'string' ? value : undefined}>{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Dekorativ uchuvchi barglar (prefers-reduced-motion'da o'chadi — CSS orqali) */
export function FloatingLeaves({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cx('pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute bottom-[-40px] animate-drift"
          style={{ left: `${(i * 97) % 100}%`, width: 14 + ((i * 7) % 16), animationDelay: `${(i * 2.3) % 17}s`, animationDuration: `${16 + ((i * 5) % 12)}s`, opacity: 0.55 }}
        >
          <path d="M5 21c0-9 5-15 15-17-1 10-7 16-15 17z" fill={i % 3 === 0 ? '#F2C14E' : i % 2 ? '#8BC34A' : '#4C9A6C'} />
          <path d="M5 21 15 9" stroke="#123B2A" strokeOpacity=".25" strokeWidth="1" />
        </svg>
      ))}
    </div>
  );
}
