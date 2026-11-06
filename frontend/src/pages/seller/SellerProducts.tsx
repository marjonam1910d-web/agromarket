import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { catName, cx, money, num } from '@/utils/format';
import { Button, Empty, ErrorState, Input, Modal, Pagination, Skeleton, Table, Tabs } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { VerificationBanner, MyProduct } from './shared';
/* ═════════ Mahsulotlar ro'yxati (ombor bilan) ═════════ */

export function SellerProducts() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [stockEdit, setStockEdit] = useState<MyProduct | null>(null);
  const [qty, setQty] = useState('');
  const q = useQuery({ queryKey: ['seller', 'products', status, page], queryFn: () => api.page<MyProduct[]>(`/products/mine${qs({ status, page })}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['seller'] });
  const vis = useMutation({ mutationFn: (v: { id: string; action: string }) => api.patch(`/products/${v.id}/visibility`, { action: v.action }), onSuccess: () => void refresh(), onError: (e) => toast(err(e), 'error') });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/products/${id}`), onSuccess: () => void refresh() });
  const stock = useMutation({ mutationFn: () => api.patch(`/products/${stockEdit!.id}/stock`, { quantity: Number(qty) }), onSuccess: () => { setStockEdit(null); void refresh(); toast(t('common.saved')); }, onError: (e) => toast(err(e), 'error') });
  return (
    <div>
      <VerificationBanner />
      <PageHeader title={t('seller.products')} actions={<Link to="/seller/products/new"><Button><Plus className="h-4 w-4" />{t('seller.addProduct')}</Button></Link>} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ value: '', label: t('common.all') }, ...(['active', 'pending_review', 'draft', 'out_of_stock', 'inactive', 'rejected'] as const).map((s) => ({ value: s, label: t(`status.prod_${s}` as TKey) }))]} />
      {q.isLoading ? <Skeleton className="h-60" /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : (
        <>
          <Table
            rows={q.data?.data ?? []}
            rowKey={(p) => p.id}
            empty={<Empty title={t('common.empty')} action={<Link to="/seller/products/new"><Button>{t('seller.addProduct')}</Button></Link>} />}
            columns={[
              { key: 'p', title: t('seller.productName'), render: (p) => (
                <div className="flex items-center gap-3 text-left">
                  <img src={img(p.image?.thumbUrl ?? p.image?.url)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <div><p className="font-bold">{p.name}</p><p className="text-xs text-muted">{catName(p.category, lang)}</p>{p.rejectionReason && p.status === 'rejected' && <p className="text-xs text-danger">{t('seller.rejectionReason', { r: p.rejectionReason })}</p>}</div>
                </div>
              ) },
              { key: 'price', title: t('common.price'), render: (p) => <span className="font-semibold">{money(p.finalPrice, lang)}</span> },
              { key: 'stock', title: t('seller.stock'), render: (p) => (
                <button onClick={() => { setStockEdit(p); setQty(String(Number(p.stock))); }} className={cx('rounded-lg px-2 py-1 font-bold hover:bg-brand-50', Number(p.stock) <= Number(p.lowStockThreshold) ? 'text-danger' : 'text-ink')}>
                  {num(p.stock)} {t(`units.${p.unit}` as TKey)} <Pencil className="ml-1 inline h-3 w-3" />
                </button>
              ) },
              { key: 's', title: t('common.status'), render: (p) => <StatusBadge status={p.status} kind="prod" /> },
              { key: 'a', title: t('common.actions'), render: (p) => (
                <div className="flex justify-end gap-1">
                  <Link to={`/product/${p.slug}`} title={t('common.view')}><Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                  <Link to={`/seller/products/${p.id}/edit`} title={t('common.edit')}><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
                  {['active', 'out_of_stock'].includes(p.status) && <Button size="icon" variant="ghost" title={t('seller.hide')} onClick={() => vis.mutate({ id: p.id, action: 'deactivate' })}><EyeOff className="h-4 w-4" /></Button>}
                  {p.status === 'inactive' && <Button size="icon" variant="ghost" title={t('seller.show')} onClick={() => vis.mutate({ id: p.id, action: 'activate' })}><Eye className="h-4 w-4 text-brand" /></Button>}
                  {['draft', 'rejected'].includes(p.status) && <Button size="icon" variant="ghost" title={t('seller.publish')} onClick={() => vis.mutate({ id: p.id, action: 'submit' })}><Send className="h-4 w-4 text-brand" /></Button>}
                  <Button size="icon" variant="ghost" title={t('seller.archive')} onClick={() => confirm(t('seller.archiveConfirm')) && del.mutate(p.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
              ) },
            ]}
          />
          <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
        </>
      )}
      <Modal open={Boolean(stockEdit)} onClose={() => setStockEdit(null)} title={t('seller.stockUpdate')} footer={<Button loading={stock.isPending} onClick={() => stock.mutate()}>{t('common.save')}</Button>}>
        <p className="mb-2 font-semibold">{stockEdit?.name}</p>
        <Input type="number" min={0} step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
      </Modal>
    </div>
  );
}

