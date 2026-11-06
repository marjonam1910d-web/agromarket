import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, FileUp } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { useAuth } from '@/store/auth';
import { cx, date, money, num } from '@/utils/format';
import { Button, Table } from '@/components/ui';
import { StatusBadge } from '@/components/common';
import type { OrderStatus, ProductCard as PC } from '@/types';


/* ═════════ Tekshiruv banneri ═════════ */
export function VerificationBanner() {
  const { t } = useI18n();
  const { user } = useAuth();
  const s = user?.sellerProfile?.verificationStatus;
  if (!s || s === 'APPROVED') return null;
  return (
    <div className={cx('mb-5 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center', s === 'PENDING' ? 'bg-sky-50 text-sky-800' : 'bg-sun-100 text-amber-900')}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-semibold">{s === 'PENDING' ? t('seller.pendingVerification') : t('seller.notVerified')}</p>
      {s !== 'PENDING' && <Link to="/seller/profile"><Button size="sm" variant="dark"><FileUp className="h-4 w-4" />{t('seller.uploadDoc')}</Button></Link>}
    </div>
  );
}

export type MyProduct = PC & { rejectionReason: string | null; updatedAt: string; lowStockThreshold: string };

export type SellerOrderRow = {
  id: string; number: string; status: OrderStatus; total: string; createdAt: string;
  items: { productName: string; quantity: string; unit: string; imageUrl: string | null }[];
  order: { id: string; orderNumber: string; recipientName: string; region: string; district: string; deliveryDate: string; deliverySlot: string; paymentMethod: string; paymentStatus: string };
  delivery: { status: string; courierName: string | null } | null;
};

export function SellerOrdersTable({ rows }: { rows: SellerOrderRow[] }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  return (
    <Table
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={(r) => nav(`/seller/orders/${r.id}`)}
      empty={<p className="py-6 text-center text-sm text-muted">{t('common.empty')}</p>}
      columns={[
        { key: 'n', title: '#', render: (r) => <span className="font-bold">{r.number}</span> },
        { key: 'b', title: t('seller.buyer'), render: (r) => r.order.recipientName },
        { key: 'i', title: t('seller.products'), render: (r) => <span className="text-sm">{r.items.map((i) => `${i.productName} (${num(i.quantity)} ${t(`units.${i.unit}` as TKey)})`).join(', ')}</span>, mobile: false },
        { key: 'd', title: t('checkout.date'), render: (r) => <span className="text-sm">{date(r.order.deliveryDate, lang, { day: 'numeric', month: 'short' })} · {r.order.deliverySlot}</span> },
        { key: 't', title: t('common.total'), render: (r) => <b>{money(r.total, lang)}</b> },
        { key: 's', title: t('common.status'), render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}

