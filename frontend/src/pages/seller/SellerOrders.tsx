import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { date, dateTime, money, num, phone } from '@/utils/format';
import { Button, Card, ErrorState, Field, Input, Modal, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui';
import { OrderTimeline, PageHeader, StatusBadge } from '@/components/common';
import type { OrderStatus } from '@/types';
import { SellerOrderRow, SellerOrdersTable } from './shared';
/* ═════════ Buyurtmalar ═════════ */
export function SellerOrders() {
  const { t } = useI18n();
  const init = new URLSearchParams(location.search).get('status') ?? '';
  const [status, setStatus] = useState(init);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['seller-orders', status, page, search], queryFn: () => api.page<SellerOrderRow[]>(`/orders/seller/list${qs({ status, page, q: search })}`), refetchInterval: 30_000 });
  const counts = (q.data?.meta.counts ?? {}) as Record<string, number>;
  return (
    <div>
      <PageHeader title={t('seller.orders')} actions={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`# / ${t('seller.buyer')}`} className="w-56" />} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: t('common.all') }, ...(['pending', 'confirmed', 'preparing', 'ready_for_delivery', 'shipped', 'delivered', 'cancelled'] as const).map((s) => ({ value: s, label: t(`status.${s}` as TKey), count: counts[s] }))]} />
      {q.isLoading ? <Skeleton className="h-60" /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : <><SellerOrdersTable rows={q.data?.data ?? []} /><Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} /></>}
    </div>
  );
}

type SODetail = Omit<SellerOrderRow, 'items' | 'order' | 'delivery'> & {
  subtotal: string; deliveryFee: string; discount: string; commissionAmount: string; sellerPayout: string; rejectionReason: string | null; allowed: OrderStatus[];
  items: { id: string; productName: string; quantity: string; unit: string; unitPrice: string; lineTotal: string; imageUrl: string | null }[];
  order: SellerOrderRow['order'] & { contactPhone: string; addressLine: string; deliveryNotes: string | null; createdAt: string };
  delivery: { status: string; courierName: string | null; courierPhone: string | null; trackingNote: string | null; history: { status: string; note: string | null; createdAt: string }[] } | null;
  statusHistory: { toStatus: string; createdAt: string; note: string | null }[];
};

export function SellerOrderDetail() {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['seller-orders', 'detail', id], queryFn: () => api.get<SODetail>(`/orders/seller/${id}`) });
  const [modal, setModal] = useState<OrderStatus | null>(null);
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState({ name: '', phone: '' });
  const [note, setNote] = useState('');
  const move = useMutation({
    mutationFn: (to: OrderStatus) => api.post(`/orders/seller/${id}/status`, { status: to, reason: reason || null, courierName: courier.name || null, courierPhone: courier.phone || null }),
    onSuccess: () => { setModal(null); setReason(''); void qc.invalidateQueries({ queryKey: ['seller-orders'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const noteM = useMutation({ mutationFn: () => api.patch(`/orders/seller/${id}/delivery`, { trackingNote: note, status: q.data?.status === 'shipped' ? 'in_transit' : undefined }), onSuccess: () => { setNote(''); void q.refetch(); } });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (!q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const o = q.data;
  const next = o.allowed.filter((s) => s !== 'cancelled');
  const actionLabel: Partial<Record<OrderStatus, TKey>> = { confirmed: 'seller.confirmOrder', preparing: 'seller.startPreparing', ready_for_delivery: 'seller.markReady', shipped: 'seller.ship', delivered: 'seller.markDelivered' };
  return (
    <div>
      <PageHeader
        title={`#${o.number}`}
        subtitle={<span className="flex flex-wrap items-center gap-2">{dateTime(o.order.createdAt, lang)} <StatusBadge status={o.status} /> <StatusBadge status={o.order.paymentStatus} kind="pay" /></span>}
        actions={<>
          {next.map((s) => <Button key={s} onClick={() => (s === 'shipped' ? setModal(s) : move.mutate(s))} loading={move.isPending && move.variables === s}>{t(actionLabel[s] ?? 'common.confirm')}</Button>)}
          {o.allowed.includes('cancelled') && <Button variant="danger" onClick={() => setModal('cancelled')}>{t('seller.rejectOrder')}</Button>}
        </>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="divide-y divide-cream-200 px-4">
            {o.items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 py-3">
                <img src={img(it.imageUrl)} alt="" className="h-14 w-14 rounded-xl object-cover" />
                <div className="flex-1"><p className="font-semibold">{it.productName}</p><p className="text-xs text-muted">{num(it.quantity)} {t(`units.${it.unit}` as TKey)} × {money(it.unitPrice, lang)}</p></div>
                <b>{money(it.lineTotal, lang)}</b>
              </div>
            ))}
            <dl className="space-y-1 py-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t('cart.subtotal')}</dt><dd>{money(o.subtotal, lang)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('cart.delivery')}</dt><dd>{money(o.deliveryFee, lang)}</dd></div>
              {Number(o.discount) > 0 && <div className="flex justify-between"><dt className="text-muted">{t('cart.discount')}</dt><dd>−{money(o.discount, lang)}</dd></div>}
              <div className="flex justify-between"><dt className="text-muted">{t('seller.commission')}</dt><dd>−{money(o.commissionAmount, lang)}</dd></div>
              <div className="flex justify-between text-base font-extrabold"><dt>{t('seller.net')}</dt><dd className="text-brand-800">{money(o.sellerPayout, lang)}</dd></div>
            </dl>
          </Card>
          {o.delivery && ['ready_for_delivery', 'shipped'].includes(o.status) && (
            <Card className="p-4">
              <p className="mb-2 flex items-center gap-2 font-bold"><Truck className="h-4 w-4 text-brand" />{t('seller.trackingNote')}</p>
              <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." /><Button loading={noteM.isPending} disabled={!note} onClick={() => noteM.mutate()}>{t('common.add')}</Button></div>
              {o.delivery.history.filter((h) => h.note && h.note !== 'created').map((h, i) => <p key={i} className="mt-2 text-xs text-muted">{dateTime(h.createdAt, lang)} — {h.note}</p>)}
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card className="p-4 text-sm">
            <p className="font-bold">{o.order.recipientName}</p>
            <a href={`tel:${o.order.contactPhone}`} className="text-brand">{phone(o.order.contactPhone)}</a>
            <p className="mt-2">{regionName(o.order.region)}, {o.order.district}, {o.order.addressLine}</p>
            <p className="mt-2 font-semibold">{date(o.order.deliveryDate, lang)} · {o.order.deliverySlot}</p>
            {o.order.deliveryNotes && <p className="mt-1 text-muted">“{o.order.deliveryNotes}”</p>}
            <p className="mt-2 text-muted">{t('checkout.payment')}: <b>{t(`checkout.${o.order.paymentMethod}` as TKey)}</b></p>
            {o.delivery?.courierName && <p className="mt-2">{t('account.courier')}: <b>{o.delivery.courierName}</b> {phone(o.delivery.courierPhone)}</p>}
          </Card>
          <Card className="p-4"><OrderTimeline status={o.status} history={o.statusHistory} /></Card>
        </div>
      </div>
      <Modal open={modal === 'shipped'} onClose={() => setModal(null)} title={t('seller.ship')} footer={<Button loading={move.isPending} disabled={!courier.name} onClick={() => move.mutate('shipped')}>{t('seller.ship')}</Button>}>
        <div className="space-y-3">
          <Field label={t('seller.courierName')} required><Input value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })} /></Field>
          <Field label={t('seller.courierPhone')}><Input value={courier.phone} onChange={(e) => setCourier({ ...courier, phone: e.target.value })} inputMode="tel" /></Field>
        </div>
      </Modal>
      <Modal open={modal === 'cancelled'} onClose={() => setModal(null)} title={t('seller.rejectOrder')} footer={<Button variant="danger" disabled={reason.length < 3} loading={move.isPending} onClick={() => move.mutate('cancelled')}>{t('common.confirm')}</Button>}>
        <Field label={t('common.reason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

