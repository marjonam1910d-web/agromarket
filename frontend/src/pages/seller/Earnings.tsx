import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, ClipboardList, TrendingUp, Wallet } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { date, money } from '@/utils/format';
import { Empty, Pagination, Table } from '@/components/ui';
import { PageHeader, StatCard } from '@/components/common';
/* ═════════ Daromad ═════════ */
export function Earnings() {
  const { t, lang } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['seller', 'earnings', page], queryFn: () => api.page<{ summary: { gross: string; commission: string; net: string; pendingNet: string }; items: { id: string; number: string; total: string; commissionAmount: string; sellerPayout: string; updatedAt: string; order: { paymentMethod: string } }[] }>(`/sellers/me/earnings?page=${page}`) });
  const s = q.data?.data.summary;
  return (
    <div>
      <PageHeader title={t('seller.earnings')} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label={t('seller.gross')} value={s ? money(s.gross, lang) : '—'} />
        <StatCard icon={<Box className="h-5 w-5" />} label={t('seller.commission')} value={s ? money(s.commission, lang) : '—'} tone="red" />
        <StatCard icon={<Wallet className="h-5 w-5" />} label={t('seller.net')} value={s ? money(s.net, lang) : '—'} tone="lime" />
        <StatCard icon={<ClipboardList className="h-5 w-5" />} label={t('seller.pendingNet')} value={s ? money(s.pendingNet, lang) : '—'} tone="blue" />
      </div>
      <Table rows={q.data?.data.items ?? []} rowKey={(r) => r.id} empty={<Empty title={t('common.empty')} />} columns={[
        { key: 'n', title: '#', render: (r) => <Link to={`/seller/orders/${r.id}`} className="font-bold text-brand">{r.number}</Link> },
        { key: 'd', title: t('common.date'), render: (r) => date(r.updatedAt, lang) },
        { key: 'm', title: t('checkout.payment'), render: (r) => t(`checkout.${r.order.paymentMethod}` as TKey) },
        { key: 't', title: t('seller.gross'), render: (r) => money(r.total, lang) },
        { key: 'c', title: t('seller.commission'), render: (r) => `−${money(r.commissionAmount, lang)}` },
        { key: 'p', title: t('seller.net'), render: (r) => <b>{money(r.sellerPayout, lang)}</b> },
      ]} />
      <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
    </div>
  );
}

