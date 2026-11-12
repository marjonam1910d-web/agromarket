import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileCheck2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
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
      <PageHeader title={t('seller.products')} actions={<div className="flex flex-wrap gap-2"><Link to="/seller/applications/new/products"><Button variant="outline"><FileCheck2 className="h-4 w-4" />{t('z.prod.batch')}</Button></Link><Link to="/seller/products/new"><Button><Plus className="h-4 w-4" />{t('seller.addProduct')}</Button></Link></div>} />
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
              { key: 'vis', title: t('z.prod.visible'), render: (p) => ['active', 'out_of_stock', 'inactive'].includes(p.status) ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.status !== 'inactive'}
                  disabled={vis.isPending}
                  onClick={() => vis.mutate({ id: p.id, action: p.status === 'inactive' ? 'activate' : 'deactivate' })}
                  className="inline-flex items-center gap-2 text-xs font-bold"
                  title={p.status === 'inactive' ? t('seller.show') : t('seller.hide')}
                >
                  <span className={cx('relative h-6 w-11 rounded-full transition', p.status === 'inactive' ? 'bg-cream-300' : 'bg-brand')}>
                    <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', p.status === 'inactive' ? 'left-0.5' : 'left-[22px]')} />
                  </span>
                  <span className={p.status === 'inactive' ? 'text-muted' : 'text-brand'}>{p.status === 'inactive' ? t('z.prod.hidden') : t('z.prod.shown')}</span>
                </button>
              ) : ['draft', 'rejected'].includes(p.status) ? <Link to={`/seller/applications/new/products?ids=${p.id}`} className="text-xs font-bold text-brand underline">{t('z.prod.toApplication')}</Link> : <span className="text-xs text-muted">—</span> },
              { key: 'a', title: t('common.actions'), render: (p) => (
                <div className="flex justify-end gap-1">
                  <Link to={`/product/${p.slug}`} title={t('common.view')}><Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                  <Link to={`/seller/products/${p.id}/edit`} title={t('common.edit')}><Button size="icon" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
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

