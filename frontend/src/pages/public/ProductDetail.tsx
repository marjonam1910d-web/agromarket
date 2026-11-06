import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BadgeCheck, ChevronRight, Flag, Heart, Leaf, MapPin, MessageCircle, Minus, Package, Plus, ShoppingBasket, Truck } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useCartActions, useErrorText, useFavorites, useRegions } from '@/hooks';
import { catName, cx, date, money, num } from '@/utils/format';
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, Pagination, Skeleton, Stars, Tabs } from '@/components/ui';
import { Price, ProductCard, ProductGrid, RegionDistrictSelect } from '@/components/common';
import type { ProductDetail as PD } from '@/types';

type Review = { id: string; rating: number; text: string | null; images: string[]; sellerReply: string | null; createdAt: string; buyer: { name: string; avatarUrl: string | null } };

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const err = useErrorText();
  const { add } = useCartActions();
  const fav = useFavorites();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['public', 'product', slug], queryFn: () => api.get<PD>(`/products/${slug}`) });
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState<number | null>(null);
  const [tab, setTab] = useState<'desc' | 'reviews' | 'farmer'>('desc');
  const [rpage, setRpage] = useState(1);
  const [dest, setDest] = useState<{ region: string; district: string | null }>({ region: '', district: null });
  const [chat, setChat] = useState(false);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const reviews = useQuery({
    queryKey: ['public', 'reviews', q.data?.id, rpage],
    queryFn: () => api.page<Review[]>(`/reviews/product/${q.data!.id}${qs({ page: rpage })}`),
    enabled: Boolean(q.data?.id),
  });
  const estimate = useQuery({
    queryKey: ['public', 'estimate', q.data?.seller.id, dest.region, dest.district, qty],
    queryFn: () =>
      api.get<{ deliverable: boolean; fee?: string; minDays?: number; maxDays?: number; freeFromAmount?: string | null }>(
        `/deliveries/estimate${qs({ sellerId: q.data!.seller.id, region: dest.region, district: dest.district, amount: Number(q.data!.finalPrice) * (qty ?? 1), weightKg: Number(q.data!.weightPerUnitKg) * (qty ?? 1) })}`,
      ),
    enabled: Boolean(q.data && dest.region && dest.district),
  });
  const send = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>('/conversations', { sellerId: q.data!.seller.id, message: { body: msg, productId: q.data!.id } }),
    onSuccess: (r) => nav(`/messages/${r.conversationId}`),
    onError: (e) => toast(err(e), 'error'),
  });
  const reportMut = useMutation({
    mutationFn: () => api.post(`/reviews/${report}/report`, { reason }),
    onSuccess: () => { setReport(null); setReason(''); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });

  if (q.isLoading) return <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2"><Skeleton className="aspect-square" /><div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-40" /></div></div>;
  if (q.isError || !q.data) return <div className="mx-auto max-w-3xl px-4 py-16"><Empty title={t('product.notFound')} action={<Link to="/catalog"><Button>{t('nav.catalog')}</Button></Link>} /></div>;
  const p = q.data;
  const min = Number(p.minOrderQty);
  const stock = Number(p.stock);
  const step = ['kg', 'litr'].includes(p.unit) && min < 1 ? 0.5 : 1;
  const quantity = qty ?? min;
  const canBuy = !p.isOwner && user?.role !== 'ADMIN' && p.status === 'active' && stock >= min;
  const images = p.images.length ? p.images : [{ id: 'x', url: '/placeholder.svg', thumbUrl: null }];
  const isFav = fav.ids.has(p.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted" aria-label="breadcrumb">
        <Link to="/catalog" className="hover:text-brand">{t('nav.catalog')}</Link>
        <ChevronRight className="h-4 w-4" />
        {p.category.parent && (<><Link to={`/catalog?category=${p.category.parent.slug}`} className="hover:text-brand">{catName(p.category.parent, lang)}</Link><ChevronRight className="h-4 w-4" /></>)}
        <Link to={`/catalog?category=${p.category.slug}`} className="hover:text-brand">{catName(p.category, lang)}</Link>
      </nav>
      {!['active', 'out_of_stock'].includes(p.status) && <div className="mb-4 rounded-xl bg-sun-100 px-4 py-2 text-sm font-semibold text-amber-800">{t('product.preview')} — {t(`status.prod_${p.status}` as TKey)}</div>}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Galereya */}
        <div>
          <motion.div layoutId={`img-${p.id}`} className="relative aspect-square overflow-hidden rounded-3xl bg-white ring-1 ring-cream-200">
            <img src={img(images[active].url)} alt={p.name} className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 flex flex-col gap-1.5">
              {p.hasDiscount && <Badge tone="red">−{Math.round((1 - Number(p.finalPrice) / Number(p.price)) * 100)}%</Badge>}
              {p.isSeasonal && <Badge tone="lime">{p.seasonLabel || t('common.seasonal')}</Badge>}
              {p.isOrganic && <Badge><Leaf className="h-3 w-3" />{t('common.organic')}</Badge>}
            </div>
          </motion.div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((im, i) => (
                <button key={im.id} onClick={() => setActive(i)} className={cx('h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition', i === active ? 'ring-brand' : 'ring-transparent opacity-70 hover:opacity-100')}>
                  <img src={img(im.thumbUrl ?? im.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ma'lumot */}
        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="flex items-center gap-1"><Stars value={p.ratingAvg} /> <b className="text-ink">{Number(p.ratingAvg).toFixed(1)}</b> ({p.ratingCount} {t('common.reviews')})</span>
            {Number(p.soldCount) > 0 && <span>· {num(p.soldCount)} {t(`units.${p.unit}` as TKey)} {t('product.sold')}</span>}
          </div>
          <div className="mt-4"><Price value={p.finalPrice} old={p.hasDiscount ? p.price : null} unit={p.unit} size="lg" /></div>

          <Card className="mt-5 divide-y divide-cream-200">
            <Link to={`/farmers/${p.seller.slug}`} className="flex items-center gap-3 p-4 hover:bg-cream-50">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-lime-50 text-xl">{p.seller.logoUrl ? <img src={img(p.seller.logoUrl)} alt="" className="h-full w-full object-cover" /> : '👨‍🌾'}</span>
              <span className="flex-1">
                <span className="flex items-center gap-1 font-bold text-ink">{p.seller.farmName}{p.seller.verificationStatus === 'APPROVED' && <BadgeCheck className="h-4 w-4 text-brand" />}</span>
                <span className="flex items-center gap-1 text-xs text-muted"><Stars value={p.seller.ratingAvg} size={11} /> · {t('farmers.products', { n: p.seller._count.products })}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted" />
            </Link>
            <div className="grid grid-cols-2 gap-3 p-4 text-sm">
              <div><p className="text-xs text-muted">{t('product.region')}</p><p className="flex items-center gap-1 font-semibold"><MapPin className="h-3.5 w-3.5 text-brand" />{regionName(p.region)}, {p.district}</p></div>
              <div><p className="text-xs text-muted">{t('product.stock')}</p><p className="flex items-center gap-1 font-semibold"><Package className="h-3.5 w-3.5 text-brand" />{num(p.stock)} {t(`units.${p.unit}` as TKey)}</p></div>
              <div><p className="text-xs text-muted">{t('product.minOrder')}</p><p className="font-semibold">{num(p.minOrderQty)} {t(`units.${p.unit}` as TKey)}</p></div>
              <div><p className="text-xs text-muted">{t('common.unitLabel')}</p><p className="font-semibold">{t(`units.${p.unit}` as TKey)}</p></div>
            </div>
          </Card>

          {p.isOwner ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone="blue">{t('product.ownProduct')}</Badge>
              <Link to={`/seller/products/${p.id}/edit`}><Button variant="outline" size="sm">{t('common.edit')}</Button></Link>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center rounded-xl bg-white ring-1 ring-cream-300">
                <button className="flex h-12 w-12 items-center justify-center text-ink disabled:opacity-40" disabled={quantity <= min} onClick={() => setQty(Math.max(min, +(quantity - step).toFixed(3)))} aria-label="−"><Minus className="h-4 w-4" /></button>
                <input value={quantity} onChange={(e) => setQty(Number(e.target.value) || min)} type="number" min={min} max={stock} step={step} className="h-12 w-16 bg-transparent text-center font-bold focus:outline-none" aria-label={t('common.quantity')} />
                <button className="flex h-12 w-12 items-center justify-center text-ink disabled:opacity-40" disabled={quantity + step > stock} onClick={() => setQty(Math.min(stock, +(quantity + step).toFixed(3)))} aria-label="+"><Plus className="h-4 w-4" /></button>
              </div>
              <Button
                size="lg"
                className="flex-1"
                disabled={!canBuy}
                loading={add.isPending}
                onClick={() => (user ? add.mutate({ productId: p.id, quantity }) : nav(`/auth?next=/product/${p.slug}`))}
              >
                <ShoppingBasket className="h-5 w-5" />
                {stock < min ? t('common.outOfStock') : user ? t('product.addToCart') : t('product.loginToBuy')}
              </Button>
              {user && user.role !== 'ADMIN' && (
                <Button size="lg" variant="outline" onClick={() => fav.toggle.mutate(p.id)} aria-label={t('nav.favorites')} aria-pressed={isFav}>
                  <Heart className={cx('h-5 w-5', isFav && 'fill-danger text-danger')} />
                </Button>
              )}
              <p className="w-full text-sm text-muted">{t('common.total')}: <b className="text-ink">{money(Number(p.finalPrice) * quantity, lang)}</b></p>
            </div>
          )}

          {!p.isOwner && (
            <Card className="mt-5 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Truck className="h-4 w-4 text-brand" />{t('product.checkDelivery')}</p>
              <RegionDistrictSelect labels={false} region={dest.region} district={dest.district} onChange={(r, d) => setDest({ region: r, district: d })} />
              {estimate.data && (
                <p className={cx('mt-3 rounded-xl px-3 py-2 text-sm font-semibold', estimate.data.deliverable ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-danger')}>
                  {estimate.data.deliverable
                    ? `${t('product.deliverable', { fee: money(estimate.data.fee, lang), days: `${estimate.data.minDays}–${estimate.data.maxDays}` })}${estimate.data.freeFromAmount ? ` · ${t('product.freeFrom', { amount: money(estimate.data.freeFromAmount, lang) })}` : ''}`
                    : t('product.notDeliverable')}
                </p>
              )}
              {user && user.role === 'BUYER' && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setChat(true)}><MessageCircle className="h-4 w-4" />{t('product.writeToSeller')}</Button>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Tablar */}
      <div className="mt-10">
        <Tabs value={tab} onChange={setTab} items={[
          { value: 'desc', label: t('product.description') },
          { value: 'reviews', label: t('product.reviews'), count: p.ratingCount },
          { value: 'farmer', label: t('product.aboutFarmer') },
        ]} />
        <Card className="mt-4 p-5 sm:p-6">
          {tab === 'desc' && <p className="whitespace-pre-line leading-relaxed text-ink-soft">{p.description}</p>}
          {tab === 'farmer' && (
            <div>
              <p className="font-bold text-ink">{p.seller.farmName}</p>
              <p className="mt-1 text-sm text-muted">{regionName(p.seller.region)}, {p.seller.district} · {t('farmers.since', { year: new Date(p.seller.createdAt).getFullYear() })}</p>
              <p className="mt-3 whitespace-pre-line text-ink-soft">{p.seller.description}</p>
              <Link to={`/farmers/${p.seller.slug}`} className="mt-4 inline-block"><Button variant="outline" size="sm">{t('common.more')}</Button></Link>
            </div>
          )}
          {tab === 'reviews' && (
            reviews.isLoading ? <Skeleton className="h-32" /> : reviews.isError ? <ErrorState onRetry={() => reviews.refetch()} /> : !reviews.data?.data.length ? (
              <p className="py-6 text-center text-muted">{t('product.noReviews')}</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div>
                  <p className="text-5xl font-extrabold text-ink">{Number(p.ratingAvg).toFixed(1)}</p>
                  <Stars value={p.ratingAvg} size={18} />
                  <div className="mt-3 space-y-1">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const c = Number((reviews.data.meta.distribution as Record<string, number>)?.[n] ?? 0);
                      return (
                        <div key={n} className="flex items-center gap-2 text-xs">
                          <span className="w-3">{n}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream-200"><span className="block h-full bg-sun" style={{ width: `${p.ratingCount ? (c / p.ratingCount) * 100 : 0}%` }} /></span>
                          <span className="w-6 text-right text-muted">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="divide-y divide-cream-200">
                  {reviews.data.data.map((r) => (
                    <div key={r.id} className="py-4 first:pt-0">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-ink">{r.buyer.name} <Badge tone="green" className="ml-1">{t('product.verifiedPurchase')}</Badge></p>
                        <span className="text-xs text-muted">{date(r.createdAt, lang)}</span>
                      </div>
                      <Stars value={r.rating} size={13} className="mt-1" />
                      {r.text && <p className="mt-2 text-sm text-ink-soft">{r.text}</p>}
                      {r.images.length > 0 && <div className="mt-2 flex gap-2">{r.images.map((u) => <img key={u} src={img(u)} alt="" className="h-16 w-16 rounded-lg object-cover" loading="lazy" />)}</div>}
                      {r.sellerReply && <p className="mt-2 rounded-xl bg-cream-100 px-3 py-2 text-sm"><b>{t('product.sellerReply')}:</b> {r.sellerReply}</p>}
                      {user && <button onClick={() => setReport(r.id)} className="mt-2 flex items-center gap-1 text-xs text-muted hover:text-danger"><Flag className="h-3 w-3" />{t('product.report')}</button>}
                    </div>
                  ))}
                  <Pagination page={rpage} pages={reviews.data.meta.pages} onChange={setRpage} />
                </div>
              </div>
            )
          )}
        </Card>
      </div>

      {p.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-extrabold text-ink">{t('product.related')}</h2>
          <ProductGrid>{p.related.slice(0, 4).map((x, i) => <ProductCard key={x.id} p={x} index={i} />)}</ProductGrid>
        </section>
      )}

      <Modal open={chat} onClose={() => setChat(false)} title={t('product.writeToSeller')} footer={<Button loading={send.isPending} disabled={msg.trim().length < 1} onClick={() => send.mutate()}>{t('chat.send')}</Button>}>
        <p className="mb-2 text-sm text-muted">{p.seller.farmName} · {p.name}</p>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className="w-full rounded-xl border border-cream-300 p-3 text-sm focus:border-brand focus:outline-none" placeholder={t('chat.placeholder')} />
      </Modal>
      <Modal open={Boolean(report)} onClose={() => setReport(null)} title={t('product.report')} footer={<Button variant="danger" loading={reportMut.isPending} disabled={reason.trim().length < 3} onClick={() => reportMut.mutate()}>{t('common.submit')}</Button>}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('product.reportReason')} />
      </Modal>
    </div>
  );
}
