import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useDebounce, useErrorText } from '@/hooks';
import { dateTime, money } from '@/utils/format';
import { Button, Empty, Field, Input, Modal, Pagination, Skeleton, Table, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ Buyurtmalar nazorati ═════════ */
type AdminOrder = { id: string; orderNumber: string; status: string; paymentStatus: string; paymentMethod: string; total: string; createdAt: string; recipientName: string; buyer: { fullName: string }; sellerOrders: { id: string; number: string; status: string; seller: { farmName: string } }[] };
export function AdminOrders() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const dq = useDebounce(search);
  const q = usePaged<AdminOrder[]>(['admin', 'orders', status, page, dq], `/admin/orders${qs({ status, page, q: dq })}`);
  const [cancel, setCancel] = useState<{ id: string; number: string } | null>(null);
  const [reason, setReason] = useState('');
  const m = useMutation({ mutationFn: () => api.post(`/admin/seller-orders/${cancel!.id}/status`, { status: 'cancelled', reason }), onSuccess: () => { setCancel(null); setReason(''); void qc.invalidateQueries({ queryKey: ['admin', 'orders'] }); }, onError: (e) => toast(err(e), 'error') });
  return (
    <div>
      <PageHeader title={t('admin.orders')} actions={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="# / tel / ism" className="w-56" />} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: t('common.all') }, ...(['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const).map((s) => ({ value: s, label: t(`status.${s}` as TKey) }))]} />
      {q.isLoading ? <Skeleton className="h-60" /> : (
        <>
          <Table rows={q.data?.data ?? []} rowKey={(o) => o.id} empty={<Empty title={t('common.empty')} />} columns={[
            { key: 'n', title: '#', render: (o) => <Link to={`/account/orders/${o.id}`} className="font-bold text-brand">{o.orderNumber}</Link> },
            { key: 'b', title: t('seller.buyer'), render: (o) => o.buyer.fullName },
            { key: 's', title: t('admin.sellers'), render: (o) => <div className="space-y-1">{o.sellerOrders.map((so) => <div key={so.id} className="flex items-center gap-1.5 text-xs">{so.seller.farmName} <StatusBadge status={so.status} />{!['delivered', 'cancelled', 'refunded'].includes(so.status) && <button className="text-danger underline" onClick={() => setCancel({ id: so.id, number: so.number })}>×</button>}</div>)}</div> },
            { key: 'd', title: t('common.date'), render: (o) => dateTime(o.createdAt, lang) },
            { key: 't', title: t('common.total'), render: (o) => <b>{money(o.total, lang)}</b> },
            { key: 'p', title: t('checkout.payment'), render: (o) => <StatusBadge status={o.paymentStatus} kind="pay" /> },
            { key: 'st', title: t('common.status'), render: (o) => <StatusBadge status={o.status} /> },
          ]} />
          <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
        </>
      )}
      <Modal open={Boolean(cancel)} onClose={() => setCancel(null)} title={`${t('account.cancelOrder')} ${cancel?.number}`} footer={<Button variant="danger" disabled={reason.length < 3} loading={m.isPending} onClick={() => m.mutate()}>{t('common.confirm')}</Button>}>
        <Field label={t('common.reason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

