import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CreditCard, FileText, Heart, MapPin, MessageCircle, Package, Pencil, Plus, Printer, Receipt as ReceiptIcon, ShoppingBag, Star, Trash2, Truck } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { date, dateTime, money, normalizePhone, num, phone } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, ErrorState, Field, Input, Modal, Pagination, Skeleton, StarInput, Stars, Tabs, Textarea } from '@/components/ui';
import { ImageUploader, OrderTimeline, PageHeader, ProductCard, ProductGrid, RegionDistrictSelect, StatCard, StatusBadge } from '@/components/common';
import type { Address, OrderStatus, ProductCard as PC } from '@/types';

type OrderListItem = {
  id: string; orderNumber: string; status: OrderStatus; paymentStatus: string; paymentMethod: string; total: string; createdAt: string;
  items: { id: string; productName: string; imageUrl: string | null; quantity: string; unit: string }[]; _count: { items: number };
  sellerOrders: { id: string; status: OrderStatus; seller: { farmName: string } }[];
};

function OrderRow({ o }: { o: OrderListItem }) {
  const { t, lang } = useI18n();
  return (
    <Link to={`/account/orders/${o.id}`} className="block rounded-2xl bg-white p-4 shadow-soft ring-1 ring-cream-200 transition hover:shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-extrabold text-ink">#{o.orderNumber}</p>
          <p className="text-xs text-muted">{dateTime(o.createdAt, lang)} · {t('account.items', { n: o._count.items })}</p>
        </div>
        <div className="flex items-center gap-2"><StatusBadge status={o.status} /><StatusBadge status={o.paymentStatus} kind="pay" /></div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {o.items.map((it) => <img key={it.id} src={img(it.imageUrl)} alt="" className="h-10 w-10 rounded-xl border-2 border-white object-cover" loading="lazy" />)}
        </div>
        <p className="text-lg font-extrabold text-brand-800">{money(o.total, lang)}</p>
      </div>
    </Link>
  );
}

export function BuyerOverview() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const orders = useQuery({ queryKey: ['orders', 'recent'], queryFn: () => api.page<OrderListItem[]>('/orders?limit=3') });
  const favs = useQuery({ queryKey: ['favorites'], queryFn: () => api.get<PC[]>('/favorites') });
  const seasonal = useQuery({ queryKey: ['public', 'products', { seasonal: 'true', limit: 4 }], queryFn: () => api.get<PC[]>('/products?seasonal=true&limit=4&sort=popular') });
  const active = orders.data?.data.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length ?? 0;
  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-800 p-6 text-white">
        <svg className="absolute -right-6 -top-6 h-40 w-40 opacity-20" viewBox="0 0 100 100" aria-hidden><path d="M10 90C10 50 40 20 90 10 80 60 50 90 10 90z" fill="#8BC34A" /></svg>
        <p className="text-sm text-white/70">{date(new Date(), lang, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{t('account.hello', { name: user?.fullName.split(' ')[0] ?? '' })}</h1>
        <Link to="/catalog"><Button variant="accent" className="mt-4">{t('landing.ctaProducts')}</Button></Link>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<ShoppingBag className="h-5 w-5" />} label={t('nav.orders')} value={orders.data?.meta.total ?? '—'} />
        <StatCard icon={<Truck className="h-5 w-5" />} label={t('status.shipped')} value={active} tone="blue" />
        <StatCard icon={<Heart className="h-5 w-5" />} label={t('nav.favorites')} value={favs.data?.length ?? '—'} tone="red" />
        <StatCard icon={<Star className="h-5 w-5" />} label={t('account.reviews')} value={<Link to="/account/reviews" className="text-brand">→</Link>} tone="yellow" />
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">{t('account.recentOrders')}</h2><Link to="/account/orders" className="text-sm font-bold text-brand">{t('common.seeAll')}</Link></div>
      {orders.isLoading ? <Skeleton className="h-28" /> : orders.data?.data.length ? <div className="space-y-3">{orders.data.data.map((o) => <OrderRow key={o.id} o={o} />)}</div> : <Empty title={t('account.noOrders')} action={<Link to="/catalog"><Button>{t('nav.catalog')}</Button></Link>} />}
      {Boolean(favs.data?.length) && (<><h2 className="mb-3 mt-8 text-lg font-extrabold">{t('nav.favorites')}</h2><ProductGrid>{favs.data!.slice(0, 4).map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid></>)}
      {Boolean(seasonal.data?.length) && (<><h2 className="mb-3 mt-8 text-lg font-extrabold">{t('landing.seasonal')}</h2><ProductGrid>{seasonal.data!.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid></>)}
    </div>
  );
}

export function BuyerOrders() {
  const { t } = useI18n();
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['orders', status, page], queryFn: () => api.page<OrderListItem[]>(`/orders${qs({ status, page })}`) });
  return (
    <div>
      <PageHeader title={t('nav.orders')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[
        { value: '', label: t('common.all') },
        ...(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const).map((s) => ({ value: s, label: t(`status.${s}` as TKey) })),
      ]} />
      {q.isLoading ? <Skeleton className="h-40" /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.data.length ? <Empty title={t('account.noOrders')} /> : (
        <><div className="space-y-3">{q.data.data.map((o) => <OrderRow key={o.id} o={o} />)}</div><Pagination page={page} pages={q.data.meta.pages} onChange={setPage} /></>
      )}
    </div>
  );
}

type OrderDetailT = {
  id: string; orderNumber: string; status: OrderStatus; paymentStatus: string; paymentMethod: string; subtotal: string; deliveryFee: string; discountTotal: string; total: string;
  recipientName: string; contactPhone: string; region: string; district: string; addressLine: string; deliveryDate: string; deliverySlot: string; deliveryNotes: string | null; createdAt: string;
  canCancel: boolean; viewer: string; payAction: { paymentId: string; checkoutUrl: string | null } | null;
  buyer: { fullName: string };
  payments: { id: string; provider: string; method: string; status: string; amount: string; paidAt: string | null }[];
  statusHistory: { toStatus: string; createdAt: string }[];
  sellerOrders: {
    id: string; number: string; status: OrderStatus; subtotal: string; deliveryFee: string; discount: string; total: string; rejectionReason: string | null;
    seller: { id: string; userId: string; farmName: string; slug: string };
    items: { id: string; productId: string; productName: string; imageUrl: string | null; unit: string; unitPrice: string; quantity: string; lineTotal: string; review: { id: string; rating: number } | null }[];
    delivery: { status: string; courierName: string | null; courierPhone: string | null; trackingNote: string | null; history: { status: string; note: string | null; createdAt: string }[] } | null;
    statusHistory: { toStatus: string; createdAt: string; note: string | null }[];
  }[];
};

export function OrderDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['orders', id], queryFn: () => api.get<OrderDetailT>(`/orders/${id}`) });
  const [cancel, setCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState<{ itemId: string; name: string } | null>(null);
  const [complain, setComplain] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['orders'] });
  const cancelM = useMutation({ mutationFn: () => api.post(`/orders/${id}/cancel`, { reason }), onSuccess: () => { setCancel(false); void refresh(); toast(t('status.cancelled')); }, onError: (e) => toast(err(e), 'error') });
  const receive = useMutation({ mutationFn: (soId: string) => api.post(`/orders/seller-orders/${soId}/receive`), onSuccess: () => void refresh(), onError: (e) => toast(err(e), 'error') });
  const chat = useMutation({
    mutationFn: (sellerId: string) => api.post<{ conversationId: string }>('/conversations', { sellerId, message: { body: `#${q.data!.orderNumber}`, orderId: id } }),
    onSuccess: (r) => nav(`/messages/${r.conversationId}`),
  });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const o = q.data;
  const paidPayment = o.payments.find((p) => ['paid', 'refunded', 'partially_refunded'].includes(p.status));

  return (
    <div className="print:p-0">
      <PageHeader
        title={<>#{o.orderNumber}</>}
        subtitle={<span className="flex flex-wrap items-center gap-2">{dateTime(o.createdAt, lang)} <StatusBadge status={o.status} /> <StatusBadge status={o.paymentStatus} kind="pay" /></span>}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {o.payAction && <Button onClick={() => (o.payAction!.checkoutUrl?.includes('/pay/sandbox/') ? nav(new URL(o.payAction!.checkoutUrl).pathname) : (window.location.href = o.payAction!.checkoutUrl!))}><CreditCard className="h-4 w-4" />{t('account.payNow')}</Button>}
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('account.invoice')}</Button>
            {paidPayment && <Link to={`/account/receipt/${paidPayment.id}`}><Button variant="outline"><ReceiptIcon className="h-4 w-4" />{t('account.receipt')}</Button></Link>}
            {o.canCancel && <Button variant="danger" onClick={() => setCancel(true)}>{t('account.cancelOrder')}</Button>}
          </div>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {o.sellerOrders.map((so) => (
            <Card key={so.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 bg-cream-50 px-4 py-3">
                <Link to={`/farmers/${so.seller.slug}`} className="flex items-center gap-1.5 font-bold hover:text-brand"><BadgeCheck className="h-4 w-4 text-brand" />{so.seller.farmName}</Link>
                <div className="flex items-center gap-2 print:hidden">
                  <StatusBadge status={so.status} />
                  <Button size="sm" variant="ghost" onClick={() => chat.mutate(so.seller.id)} aria-label={t('product.writeToSeller')}><MessageCircle className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid gap-5 p-4 md:grid-cols-[1fr_220px]">
                <ul className="divide-y divide-cream-200">
                  {so.items.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 py-3 first:pt-0">
                      <img src={img(it.imageUrl)} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
                      <div className="flex-1">
                        <p className="font-semibold">{it.productName}</p>
                        <p className="text-xs text-muted">{num(it.quantity)} {t(`units.${it.unit}` as TKey)} × {money(it.unitPrice, lang)}</p>
                        {so.status === 'delivered' && o.viewer === 'buyer' && (it.review ? <Stars value={it.review.rating} size={12} /> : <button onClick={() => setReview({ itemId: it.id, name: it.productName })} className="mt-1 text-xs font-bold text-brand print:hidden"><Star className="mr-1 inline h-3 w-3" />{t('account.leaveReview')}</button>)}
                      </div>
                      <p className="font-bold">{money(it.lineTotal, lang)}</p>
                    </li>
                  ))}
                </ul>
                <div className="print:hidden">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t('account.timeline')}</p>
                  <OrderTimeline status={so.status} history={so.statusHistory} />
                </div>
              </div>
              {so.delivery && (so.delivery.courierName || so.delivery.trackingNote) && (
                <div className="mx-4 mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm">
                  <p className="flex items-center gap-2 font-bold text-brand-800"><Truck className="h-4 w-4" />{t('account.courier')}: {so.delivery.courierName} {so.delivery.courierPhone && <a href={`tel:${so.delivery.courierPhone}`} className="underline">{phone(so.delivery.courierPhone)}</a>}</p>
                  {so.delivery.history.filter((h) => h.note && h.note !== 'created').slice(-2).map((h, i) => <p key={i} className="text-xs text-brand-700">{dateTime(h.createdAt, lang)} — {h.note}</p>)}
                  <p className="mt-1 text-[11px] text-muted">{t('account.noGps')}</p>
                </div>
              )}
              {so.rejectionReason && <p className="mx-4 mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{t('common.reason')}: {so.rejectionReason}</p>}
              {so.status === 'shipped' && o.viewer === 'buyer' && <div className="px-4 pb-4 print:hidden"><Button onClick={() => receive.mutate(so.id)} loading={receive.isPending}><Package className="h-4 w-4" />{t('account.received')}</Button></div>}
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand" />{t('checkout.address')}</p>
            <p>{o.recipientName} · {phone(o.contactPhone)}</p>
            <p className="text-ink-soft">{regionName(o.region)}, {o.district}, {o.addressLine}</p>
            <p className="mt-2 text-muted">{date(o.deliveryDate, lang)} · {o.deliverySlot}</p>
            {o.deliveryNotes && <p className="mt-1 text-xs text-muted">“{o.deliveryNotes}”</p>}
          </Card>
          <Card className="p-4 text-sm">
            <dl className="space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal')}</dt><dd>{money(o.subtotal, lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('cart.delivery')}</dt><dd>{money(o.deliveryFee, lang)}</dd></div>
              {Number(o.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>{t('cart.discount')}</dt><dd>−{money(o.discountTotal, lang)}</dd></div>}
              <div className="flex justify-between border-t border-cream-200 pt-2 text-base font-extrabold"><dt>{t('cart.total')}</dt><dd>{money(o.total, lang)}</dd></div>
              <div className="flex justify-between pt-1"><dt className="text-muted">{t('checkout.payment')}</dt><dd className="font-semibold">{t(`checkout.${o.paymentMethod}` as TKey)}</dd></div>
            </dl>
          </Card>
          {o.viewer === 'buyer' && <Button variant="ghost" block className="print:hidden" onClick={() => setComplain(true)}><FileText className="h-4 w-4" />{t('account.newComplaint')}</Button>}
        </div>
      </div>
      <Modal open={cancel} onClose={() => setCancel(false)} title={t('account.cancelOrder')} footer={<Button variant="danger" disabled={reason.trim().length < 3} loading={cancelM.isPending} onClick={() => cancelM.mutate()}>{t('common.confirm')}</Button>}>
        <Field label={t('account.cancelReason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
      {review && <ReviewModal item={review} onClose={() => { setReview(null); void refresh(); }} />}
      {complain && <ComplaintModal orderId={o.id} onClose={() => setComplain(false)} />}
    </div>
  );
}

export function ReviewModal({ item, onClose }: { item: { itemId: string; name: string }; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const [rating, setRating] = useState(5);
  const [sellerRating, setSellerRating] = useState(5);
  const [text, setText] = useState('');
  const [images, setImages] = useState<{ url: string; thumbUrl?: string | null }[]>([]);
  const m = useMutation({
    mutationFn: () => api.post('/reviews', { orderItemId: item.itemId, rating, sellerRating, text: text || undefined, images: images.map((i) => i.url) }),
    onSuccess: () => { toast(t('common.saved')); onClose(); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Modal open onClose={onClose} title={`${t('account.leaveReview')}: ${item.name}`} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>{t('common.submit')}</Button>}>
      <div className="space-y-4">
        <Field label={t('account.ratingProduct')}><StarInput value={rating} onChange={setRating} /></Field>
        <Field label={t('account.ratingSeller')}><StarInput value={sellerRating} onChange={setSellerRating} /></Field>
        <Field label={t('account.yourReview')}><Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} /></Field>
        <ImageUploader value={images} onChange={setImages} folder="reviews" max={5} />
      </div>
    </Modal>
  );
}

function ComplaintModal({ orderId, onClose }: { orderId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const m = useMutation({
    mutationFn: () => api.post('/complaints', { subject, description, orderId: orderId ?? null }),
    onSuccess: () => { toast(t('common.saved')); void qc.invalidateQueries({ queryKey: ['complaints'] }); onClose(); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Modal open onClose={onClose} title={t('account.newComplaint')} footer={<Button disabled={subject.length < 3 || description.length < 10} loading={m.isPending} onClick={() => m.mutate()}>{t('common.submit')}</Button>}>
      <div className="space-y-3">
        <Field label={t('account.subject')}><Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></Field>
        <Field label={t('account.description')} hint={t('validation.min', { n: 10 })}><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} /></Field>
      </div>
    </Modal>
  );
}

export function Receipt() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['receipt', id], queryFn: () => api.get<{ receiptNo: string; orderNumber: string; amount: string; refundedAmount: string; provider: string; method: string; providerTxId: string | null; paidAt: string; status: string; buyer: { name: string; phone: string } }>(`/payments/${id}/receipt`) });
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (!q.data) return <ErrorState />;
  const r = q.data;
  return (
    <Card className="mx-auto max-w-md p-6 print:shadow-none">
      <div className="flex items-center justify-between"><p className="text-xl font-extrabold text-brand-800">AgroMarket</p><Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button></div>
      <p className="mt-1 text-sm text-muted">{t('account.receipt')} {r.receiptNo}</p>
      <dl className="mt-5 space-y-2 border-y border-dashed border-cream-300 py-4 text-sm">
        {[[t('account.orderNo', { n: '' }), `#${r.orderNumber}`], [t('common.date'), dateTime(r.paidAt, lang)], [t('checkout.payment'), `${r.method.toUpperCase()} (${r.provider})`], ['ID', r.providerTxId ?? '—'], [t('checkout.recipient'), r.buyer.name], [t('common.phone'), phone(r.buyer.phone)], [t('common.status'), t(`status.pay_${r.status}` as TKey)]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-4 flex justify-between text-lg font-extrabold"><span>{t('common.total')}</span><span>{money(r.amount, lang)}</span></div>
      {Number(r.refundedAmount) > 0 && <p className="text-right text-sm text-danger">−{money(r.refundedAmount, lang)}</p>}
      {r.provider === 'sandbox' && <p className="mt-4 rounded-lg bg-sun-100 px-3 py-2 text-center text-xs font-bold text-amber-800">{t('common.sandbox')}</p>}
    </Card>
  );
}

export function Favorites() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api.get<PC[]>('/favorites') });
  return (
    <div>
      <PageHeader title={t('nav.favorites')} />
      {q.isLoading ? <Skeleton className="h-60" /> : !q.data?.length ? <Empty icon={<Heart className="h-7 w-7" />} title={t('common.empty')} action={<Link to="/catalog"><Button>{t('nav.catalog')}</Button></Link>} /> : <ProductGrid>{q.data.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}</ProductGrid>}
    </div>
  );
}

export function Addresses() {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['addresses'], queryFn: () => api.get<Address[]>('/users/me/addresses') });
  const empty = { label: 'Uy', recipientName: '', phone: '', region: '', district: null as string | null, street: '', landmark: '', isDefault: false };
  const [edit, setEdit] = useState<(typeof empty & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...edit, phone: normalizePhone(edit!.phone) ?? edit!.phone, landmark: edit!.landmark || null };
      delete (body as { id?: string }).id;
      return edit!.id ? api.put(`/users/me/addresses/${edit!.id}`, body) : api.post('/users/me/addresses', body);
    },
    onSuccess: () => { setEdit(null); void qc.invalidateQueries({ queryKey: ['addresses'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/users/me/addresses/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }) });
  return (
    <div>
      <PageHeader title={t('account.addresses')} actions={<Button onClick={() => setEdit(empty)}><Plus className="h-4 w-4" />{t('common.add')}</Button>} />
      {q.isLoading ? <Skeleton className="h-32" /> : !q.data?.length ? <Empty icon={<MapPin className="h-7 w-7" />} title={t('common.empty')} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.data.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between">
                <p className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand" />{a.label}{a.isDefault && <Badge>{t('account.default')}</Badge>}</p>
                <div className="flex gap-1">
                  <button onClick={() => setEdit({ ...a, landmark: a.landmark ?? '' })} className="rounded-lg p-1.5 text-muted hover:bg-cream-100" aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del.mutate(a.id)} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-danger" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 text-sm">{a.street}{a.landmark && ` (${a.landmark})`}</p>
              <p className="text-sm text-ink-soft">{regionName(a.region)}, {a.district}</p>
              <p className="mt-1 text-xs text-muted">{a.recipientName} · {phone(a.phone)}</p>
            </Card>
          ))}
        </div>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? t('common.edit') : t('checkout.newAddress')} footer={<Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button>}>
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('common.name')}><Input value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></Field>
              <Field label={t('checkout.recipient')}><Input value={edit.recipientName} onChange={(e) => setEdit({ ...edit, recipientName: e.target.value })} /></Field>
            </div>
            <Field label={t('common.phone')}><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} inputMode="tel" /></Field>
            <RegionDistrictSelect region={edit.region} district={edit.district} onChange={(r, d) => setEdit({ ...edit, region: r, district: d })} />
            <Field label={t('checkout.street')}><Input value={edit.street} onChange={(e) => setEdit({ ...edit, street: e.target.value })} /></Field>
            <Field label={t('checkout.landmark')}><Input value={edit.landmark} onChange={(e) => setEdit({ ...edit, landmark: e.target.value })} /></Field>
            <Checkbox checked={edit.isDefault} onChange={(e) => setEdit({ ...edit, isDefault: e.target.checked })} label={t('account.setDefault')} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function MyReviews() {
  const { t, lang } = useI18n();
  const eligible = useQuery({ queryKey: ['reviews', 'eligible'], queryFn: () => api.get<{ id: string; productName: string; imageUrl: string | null; order: { orderNumber: string } }[]>('/reviews/eligible') });
  const mine = useQuery({ queryKey: ['reviews', 'mine'], queryFn: () => api.get<{ id: string; rating: number; text: string | null; status: string; createdAt: string; sellerReply: string | null; product: { name: string; slug: string } }[]>('/reviews/mine') });
  const [item, setItem] = useState<{ itemId: string; name: string } | null>(null);
  return (
    <div>
      <PageHeader title={t('account.reviews')} />
      {Boolean(eligible.data?.length) && (
        <Card className="mb-6 p-4">
          <p className="mb-3 font-bold">{t('account.toReview')}</p>
          <div className="space-y-2">
            {eligible.data!.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <img src={img(e.imageUrl)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                <div className="flex-1"><p className="font-semibold">{e.productName}</p><p className="text-xs text-muted">#{e.order.orderNumber}</p></div>
                <Button size="sm" onClick={() => setItem({ itemId: e.id, name: e.productName })}><Star className="h-4 w-4" />{t('account.leaveReview')}</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {mine.isLoading ? <Skeleton className="h-32" /> : !mine.data?.length ? <Empty title={t('common.empty')} /> : (
        <div className="space-y-3">
          {mine.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex justify-between"><Link to={`/product/${r.product.slug}`} className="font-bold hover:text-brand">{r.product.name}</Link><span className="text-xs text-muted">{date(r.createdAt, lang)}</span></div>
              <Stars value={r.rating} size={13} />
              {r.text && <p className="mt-1 text-sm text-ink-soft">{r.text}</p>}
              {r.sellerReply && <p className="mt-2 rounded-lg bg-cream-100 px-3 py-2 text-sm"><b>{t('product.sellerReply')}:</b> {r.sellerReply}</p>}
              {r.status === 'hidden' && <Badge tone="gray" className="mt-2">hidden</Badge>}
            </Card>
          ))}
        </div>
      )}
      {item && <ReviewModal item={item} onClose={() => { setItem(null); void eligible.refetch(); void mine.refetch(); }} />}
    </div>
  );
}

export function Support() {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['complaints'], queryFn: () => api.get<{ id: string; subject: string; description: string; status: string; resolution: string | null; createdAt: string; order: { orderNumber: string } | null }[]>('/complaints/mine') });
  const [open, setOpen] = useState(false);
  return (
    <div>
      <PageHeader title={t('account.support')} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{t('account.newComplaint')}</Button>} />
      {q.isLoading ? <Skeleton className="h-32" /> : !q.data?.length ? <Empty title={t('common.empty')} /> : (
        <div className="space-y-3">
          {q.data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-bold">{c.subject}</p><StatusBadge status={c.status} kind="c" /></div>
              <p className="text-xs text-muted">{dateTime(c.createdAt, lang)}{c.order && ` · #${c.order.orderNumber}`}</p>
              <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
              {c.resolution && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800"><b>{t('admin.resolution')}:</b> {c.resolution}</p>}
            </Card>
          ))}
        </div>
      )}
      {open && <ComplaintModal onClose={() => setOpen(false)} />}
    </div>
  );
}

