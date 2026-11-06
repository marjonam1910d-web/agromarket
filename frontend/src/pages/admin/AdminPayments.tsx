import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { dateTime, money } from '@/utils/format';
import { Badge, Button, Empty, Field, Modal, Pagination, Table, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ To'lovlar va qaytarishlar ═════════ */
export function AdminPayments() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'payments' | 'refunds'>('refunds');
  const [page, setPage] = useState(1);
  const pays = usePaged<{ id: string; provider: string; method: string; amount: string; status: string; createdAt: string; order: { orderNumber: string }; transactions: { providerTxId: string }[] }[]>(['admin', 'payments', page], `/admin/payments?page=${page}`);
  const refunds = usePaged<{ id: string; amount: string; reason: string; status: string; createdAt: string; payment: { provider: string; method: string; order: { orderNumber: string; id: string } }; sellerOrder: { number: string } | null }[]>(['admin', 'refunds', page], `/admin/refunds?page=${page}`);
  const [proc, setProc] = useState<{ id: string; approve: boolean; provider: string } | null>(null);
  const [note, setNote] = useState('');
  const m = useMutation({ mutationFn: () => api.post(`/admin/refunds/${proc!.id}/process`, { approve: proc!.approve, note }), onSuccess: () => { setProc(null); setNote(''); void qc.invalidateQueries({ queryKey: ['admin'] }); toast(t('common.saved')); }, onError: (e) => toast(err(e), 'error') });
  const providers = pays.data?.meta.providers as Record<string, string> | undefined;
  return (
    <div>
      <PageHeader title={t('admin.payments')} />
      {providers && <div className="mb-4 flex flex-wrap gap-2">{Object.entries(providers).map(([k, v]) => <Badge key={k} tone={v.includes('sozlanmagan') ? 'yellow' : 'green'}>{k}: {v}</Badge>)}</div>}
      <Tabs className="mb-4" value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: 'refunds', label: t('admin.refunds') }, { value: 'payments', label: t('admin.payments') }]} />
      {tab === 'payments' ? (
        <Table rows={pays.data?.data ?? []} rowKey={(p) => p.id} empty={<Empty title={t('common.empty')} />} columns={[
          { key: 'o', title: '#', render: (p) => <b>{p.order.orderNumber}</b> },
          { key: 'm', title: t('checkout.payment'), render: (p) => `${p.method} · ${p.provider}` },
          { key: 'tx', title: 'TX', render: (p) => <span className="font-mono text-xs">{p.transactions[0]?.providerTxId ?? '—'}</span>, mobile: false },
          { key: 'a', title: t('common.total'), render: (p) => money(p.amount, lang) },
          { key: 'd', title: t('common.date'), render: (p) => dateTime(p.createdAt, lang) },
          { key: 's', title: t('common.status'), render: (p) => <StatusBadge status={p.status} kind="pay" /> },
        ]} />
      ) : (
        <Table rows={refunds.data?.data ?? []} rowKey={(r) => r.id} empty={<Empty icon={<Undo2 className="h-7 w-7" />} title={t('common.empty')} />} columns={[
          { key: 'o', title: '#', render: (r) => <Link to={`/account/orders/${r.payment.order.id}`} className="font-bold text-brand">{r.sellerOrder?.number ?? r.payment.order.orderNumber}</Link> },
          { key: 'p', title: t('checkout.payment'), render: (r) => `${r.payment.method} · ${r.payment.provider}` },
          { key: 'a', title: t('common.total'), render: (r) => <b>{money(r.amount, lang)}</b> },
          { key: 'r', title: t('common.reason'), render: (r) => <span className="text-sm">{r.reason}</span> },
          { key: 's', title: t('common.status'), render: (r) => <StatusBadge status={r.status} kind="r" /> },
          { key: 'x', title: '', render: (r) => r.status === 'requested' && <div className="flex gap-1"><Button size="sm" onClick={() => setProc({ id: r.id, approve: true, provider: r.payment.provider })}>{t('admin.processRefund')}</Button><Button size="sm" variant="ghost" onClick={() => setProc({ id: r.id, approve: false, provider: r.payment.provider })}>{t('admin.reject')}</Button></div> },
        ]} />
      )}
      <Pagination page={page} pages={(tab === 'payments' ? pays.data?.meta.pages : refunds.data?.meta.pages) ?? 1} onChange={setPage} />
      <Modal open={Boolean(proc)} onClose={() => setProc(null)} title={proc?.approve ? t('admin.processRefund') : t('admin.reject')} footer={<Button variant={proc?.approve ? 'primary' : 'danger'} loading={m.isPending} onClick={() => m.mutate()}>{t('common.confirm')}</Button>}>
        {proc?.approve && proc.provider !== 'sandbox' && <p className="mb-3 rounded-xl bg-sun-100 px-3 py-2 text-sm text-amber-800">{t('admin.manualRefund')}</p>}
        <Field label={t('common.note')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

