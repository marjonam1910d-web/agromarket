import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Printer, Undo2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PaymentMethod, IntegrationsPanel } from '@/components/PayBrand';
import { ReceiptPrinter, type ReceiptData } from '@/components/ReceiptPrinter';
import { api as http } from '@/services/api';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { dateTime, money } from '@/utils/format';
import { Button, Empty, Field, Modal, Pagination, Skeleton, Table, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ To'lovlar va qaytarishlar ═════════ */
export function AdminPayments() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'payments' | 'refunds'>('payments');
  const [receipt, setReceipt] = useState<string | null>(null);
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
      {providers && <div className="mb-4"><IntegrationsPanel compact data={{ payments: providers, channels: {} }} /></div>}
      <Tabs className="mb-4" value={tab} onChange={(v) => { setTab(v); setPage(1); }} items={[{ value: 'payments', label: t('admin.payments') }, { value: 'refunds', label: t('admin.refunds') }]} />
      {tab === 'payments' ? (
        <Table rows={pays.data?.data ?? []} rowKey={(p) => p.id} empty={<Empty title={t('common.empty')} />} columns={[
          { key: 'o', title: '#', render: (p) => <b>{p.order.orderNumber}</b> },
          { key: 'm', title: t('checkout.payment'), render: (p) => <PaymentMethod method={p.method} provider={p.provider} /> },
          { key: 'tx', title: 'TX', render: (p) => <span className="font-mono text-xs">{p.transactions[0]?.providerTxId ?? '—'}</span>, mobile: false },
          { key: 'a', title: t('common.total'), render: (p) => money(p.amount, lang) },
          { key: 'd', title: t('common.date'), render: (p) => dateTime(p.createdAt, lang) },
          { key: 's', title: t('common.status'), render: (p) => <StatusBadge status={p.status} kind="pay" /> },
          { key: 'v', title: '', render: (p) => <Button size="icon" variant="ghost" title={t('z.pay.viewReceipt')} aria-label={t('z.pay.viewReceipt')} onClick={() => setReceipt(p.id)}><Eye className="h-4 w-4 text-brand" /></Button> },
        ]} />
      ) : (
        <Table rows={refunds.data?.data ?? []} rowKey={(r) => r.id} empty={<Empty icon={<Undo2 className="h-7 w-7" />} title={t('common.empty')} />} columns={[
          { key: 'o', title: '#', render: (r) => <Link to={`/account/orders/${r.payment.order.id}`} className="font-bold text-brand">{r.sellerOrder?.number ?? r.payment.order.orderNumber}</Link> },
          { key: 'p', title: t('checkout.payment'), render: (r) => <PaymentMethod method={r.payment.method} provider={r.payment.provider} /> },
          { key: 'a', title: t('common.total'), render: (r) => <b>{money(r.amount, lang)}</b> },
          { key: 'r', title: t('common.reason'), render: (r) => <span className="text-sm">{r.reason}</span> },
          { key: 's', title: t('common.status'), render: (r) => <StatusBadge status={r.status} kind="r" /> },
          { key: 'x', title: '', render: (r) => r.status === 'requested' && <div className="flex gap-1"><Button size="sm" onClick={() => setProc({ id: r.id, approve: true, provider: r.payment.provider })}>{t('admin.processRefund')}</Button><Button size="sm" variant="ghost" onClick={() => setProc({ id: r.id, approve: false, provider: r.payment.provider })}>{t('admin.reject')}</Button></div> },
        ]} />
      )}
      <Pagination page={page} pages={(tab === 'payments' ? pays.data?.meta.pages : refunds.data?.meta.pages) ?? 1} onChange={setPage} />
      {receipt && <ReceiptModal id={receipt} onClose={() => setReceipt(null)} />}
      <Modal open={Boolean(proc)} onClose={() => setProc(null)} title={proc?.approve ? t('admin.processRefund') : t('admin.reject')} footer={<Button variant={proc?.approve ? 'primary' : 'danger'} loading={m.isPending} onClick={() => m.mutate()}>{t('common.confirm')}</Button>}>
        {proc?.approve && proc.provider !== 'sandbox' && <p className="mb-3 rounded-xl bg-sun-100 px-3 py-2 text-sm text-amber-800">{t('admin.manualRefund')}</p>}
        <Field label={t('common.note')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}


/** To'lov cheki (admin): to'langan, to'lanmagan yoki qaytarilgan — barcha holatlar */
export function ReceiptModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['admin', 'receipt', id], queryFn: () => http.get<{ receiptNo: string; provider: string; method: string; status: string; amount: string; refundedAmount: string; providerTxId: string | null; paidAt: string | null; buyer: { name: string; phone: string }; receipt: ReceiptData }>(`/backoffice/payments/${id}/receipt`) });
  const r = q.data;
  return (
    <Modal open onClose={onClose} title={r ? `${t('account.receipt')} ${r.receiptNo}` : t('account.receipt')} footer={<Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('y.contract.print')}</Button>}>
      {!r ? <Skeleton className="h-96" /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-50 px-3 py-2 text-sm">
            <PaymentMethod method={r.method} provider={r.provider} />
            <StatusBadge status={r.status} kind="pay" />
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">{t('checkout.recipient')}</dt><dd className="text-right font-semibold">{r.buyer.name}</dd>
            <dt className="text-muted">{t('common.date')}</dt><dd className="text-right font-semibold">{r.paidAt ? dateTime(r.paidAt, lang) : '—'}</dd>
            <dt className="text-muted">ID</dt><dd className="truncate text-right font-mono">{r.providerTxId ?? '—'}</dd>
            {Number(r.refundedAmount) > 0 && <><dt className="text-muted">{t('admin.refunds')}</dt><dd className="text-right font-semibold text-danger">−{money(r.refundedAmount, lang)}</dd></>}
          </dl>
          <div className="flex justify-center rounded-2xl bg-cream-100 py-3"><ReceiptPrinter data={r.receipt} /></div>
        </div>
      )}
    </Modal>
  );
}
