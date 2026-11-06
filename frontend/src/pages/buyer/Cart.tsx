import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BadgeCheck, Minus, Plus, ShoppingBasket, Tag, Trash2 } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { img } from '@/services/api';
import { useCart, useCartActions } from '@/hooks';
import { money, num } from '@/utils/format';
import { Button, Card, Empty, ErrorState, Input, Skeleton } from '@/components/ui';
import { RegionDistrictSelect } from '@/components/common';
import type { CartLine, Quote } from '@/types';

export function CartSummary({ quote, children }: { quote: Quote; children?: React.ReactNode }) {
  const { t, lang } = useI18n();
  return (
    <Card className="p-5">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal')}</dt><dd className="font-semibold">{money(quote.subtotal, lang)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{t('cart.delivery')}</dt><dd className="font-semibold">{quote.deliveryKnown ? money(quote.deliveryFee, lang) : <span className="text-muted">{t('cart.deliveryUnknown')}</span>}</dd></div>
        {Number(quote.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>{t('cart.discount')} {quote.coupon && `(${quote.coupon.code})`}</dt><dd className="font-semibold">−{money(quote.discountTotal, lang)}</dd></div>}
        <div className="flex justify-between border-t border-cream-200 pt-3 text-base"><dt className="font-bold">{t('cart.total')}</dt><dd className="text-xl font-extrabold text-brand-800">{money(quote.total, lang)}</dd></div>
      </dl>
      {children}
    </Card>
  );
}

function Line({ l }: { l: CartLine }) {
  const { t, lang } = useI18n();
  const { update, remove } = useCartActions();
  const step = Number(l.minOrderQty) < 1 ? 0.5 : 1;
  const qty = Number(l.quantity);
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} className="flex gap-3 py-4">
      <Link to={`/product/${l.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-cream-100"><img src={img(l.image)} alt="" className="h-full w-full object-cover" loading="lazy" /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/product/${l.slug}`} className="line-clamp-2 font-bold text-ink hover:text-brand">{l.name}</Link>
          <button onClick={() => remove.mutate(l.id)} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" aria-label={t('cart.remove')}><Trash2 className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted">{money(l.unitPrice, lang)} / {t(`units.${l.unit}` as TKey)}</p>
        {l.issue && (
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle className="h-3.5 w-3.5" />{t(`cart.issue_${l.issue}` as TKey, { n: l.issue === 'BELOW_MIN_QTY' ? num(l.minOrderQty) : num(l.stock) })}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex h-9 items-center rounded-lg ring-1 ring-cream-300">
            <button className="flex h-9 w-9 items-center justify-center disabled:opacity-40" disabled={qty - step < Number(l.minOrderQty) || update.isPending} onClick={() => update.mutate({ id: l.id, quantity: +(qty - step).toFixed(3) })} aria-label="−"><Minus className="h-3.5 w-3.5" /></button>
            <span className="min-w-12 text-center text-sm font-bold">{num(l.quantity)} {t(`units.${l.unit}` as TKey)}</span>
            <button className="flex h-9 w-9 items-center justify-center disabled:opacity-40" disabled={qty + step > Number(l.stock) || update.isPending} onClick={() => update.mutate({ id: l.id, quantity: +(qty + step).toFixed(3) })} aria-label="+"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <p className="font-extrabold text-ink">{money(l.lineTotal, lang)}</p>
        </div>
      </div>
    </motion.li>
  );
}

export default function CartPage() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const [dest, setDest] = useState<{ region: string; district: string | null }>({ region: '', district: null });
  const cart = useCart(dest.region && dest.district ? { region: dest.region, district: dest.district } : {});
  const { coupon, clear } = useCartActions();
  const [code, setCode] = useState('');

  if (cart.isLoading) return <div className="mx-auto max-w-6xl space-y-3 px-4 py-8"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  if (cart.isError) return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorState onRetry={() => cart.refetch()} /></div>;
  const q = cart.data!;
  if (!q.itemCount) return <div className="mx-auto max-w-3xl px-4 py-12"><Empty icon={<ShoppingBasket className="h-7 w-7" />} title={t('cart.empty')} hint={t('cart.emptyHint')} action={<Link to="/catalog"><Button>{t('landing.ctaProducts')}</Button></Link>} /></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{t('cart.title')} <span className="text-muted">({q.itemCount})</span></h1>
        <Button variant="ghost" size="sm" onClick={() => clear.mutate()}><Trash2 className="h-4 w-4" />{t('cart.clear')}</Button>
      </div>
      {q.hasIssues && <p className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger"><AlertTriangle className="h-4 w-4" />{t('cart.fixIssues')}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {q.groups.map((g) => (
            <Card key={g.seller.id} className="px-4 sm:px-5">
              <div className="flex items-center justify-between border-b border-cream-200 py-3">
                <Link to={`/farmers/${g.seller.slug}`} className="flex items-center gap-1.5 font-bold text-ink hover:text-brand"><BadgeCheck className="h-4 w-4 text-brand" />{t('cart.fromSeller', { name: g.seller.farmName })}</Link>
                {g.deliveryFee !== null && <span className="text-xs text-muted">{t('cart.delivery')}: <b className="text-ink">{money(g.deliveryFee, lang)}</b>{g.eta && ` · ${g.eta.minDays}–${g.eta.maxDays} d`}</span>}
              </div>
              {g.deliverable === false && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-danger">{t('cart.notDeliverable')}</p>}
              <ul className="divide-y divide-cream-200"><AnimatePresence initial={false}>{g.items.map((l) => <Line key={l.id} l={l} />)}</AnimatePresence></ul>
            </Card>
          ))}
        </div>
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <p className="mb-2 text-sm font-bold">{t('cart.estimate')}</p>
            <RegionDistrictSelect labels={false} region={dest.region} district={dest.district} onChange={(r, d) => setDest({ region: r, district: d })} />
          </Card>
          <Card className="p-5">
            {q.coupon ? (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-success"><Tag className="h-4 w-4" />{q.coupon.code}</span>
                <Button size="sm" variant="ghost" onClick={() => coupon.mutate(null)}>{t('cart.removeCoupon')}</Button>
              </div>
            ) : (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) coupon.mutate(code.trim()); }}>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('cart.coupon')} left={<Tag className="h-4 w-4" />} aria-label={t('cart.coupon')} />
                <Button type="submit" variant="secondary" loading={coupon.isPending}>{t('cart.applyCoupon')}</Button>
              </form>
            )}
            {q.couponError && <p className="mt-2 text-xs text-danger">{q.couponError}</p>}
          </Card>
          <CartSummary quote={q}>
            <Button block size="lg" className="mt-4" disabled={q.hasIssues} onClick={() => nav('/checkout')}>{t('cart.checkout')}</Button>
          </CartSummary>
        </div>
      </div>
    </div>
  );
}
