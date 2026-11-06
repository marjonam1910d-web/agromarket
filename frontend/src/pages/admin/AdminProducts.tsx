import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, img, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useDebounce, useErrorText } from '@/hooks';
import { catName, money, num } from '@/utils/format';
import { Button, Card, Empty, Field, Input, Modal, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ Mahsulot moderatsiyasi ═════════ */
type AdminProduct = { id: string; name: string; slug: string; description: string; price: string; discountPrice: string | null; unit: string; status: string; rejectionReason: string | null; updatedAt: string; images: { url: string }[]; inventory: { quantity: string } | null; seller: { farmName: string; verificationStatus: string }; category: { nameUz: string; nameRu: string; nameEn: string } };
export function AdminProducts() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [status, setStatus] = useState('pending_review');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const dq = useDebounce(search);
  const q = usePaged<AdminProduct[]>(['admin', 'products', status, page, dq], `/admin/products${qs({ status, page, q: dq })}`);
  const [act, setAct] = useState<{ p: AdminProduct; decision: 'reject' | 'deactivate' } | null>(null);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: (v: { id: string; decision: string; reason?: string }) => api.post(`/admin/products/${v.id}/moderate`, { decision: v.decision, reason: v.reason }),
    onSuccess: () => { setAct(null); setReason(''); void qc.invalidateQueries({ queryKey: ['admin'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div>
      <PageHeader title={t('admin.products')} actions={<Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('common.search')} className="w-56" />} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={(['pending_review', 'active', 'rejected', 'inactive', 'out_of_stock', 'draft', ''] as const).map((s) => ({ value: s, label: s ? t(`status.prod_${s}` as TKey) : t('common.all') }))} />
      {q.isLoading ? <Skeleton className="h-60" /> : !q.data?.data.length ? <Empty title={t('common.empty')} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.data.map((p) => (
            <Card key={p.id} className="flex gap-3 p-4">
              <img src={img(p.images[0]?.url)} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><Link to={`/product/${p.slug}`} className="font-bold hover:text-brand">{p.name}</Link><StatusBadge status={p.status} kind="prod" /></div>
                <p className="text-xs text-muted">{p.seller.farmName} · {catName(p.category, lang)}</p>
                <p className="text-sm font-semibold">{money(p.discountPrice ?? p.price, lang)} / {t(`units.${p.unit}` as TKey)} · {num(p.inventory?.quantity ?? 0)}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{p.description}</p>
                {p.rejectionReason && <p className="text-xs text-danger">{p.rejectionReason}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.status === 'pending_review' && <Button size="sm" onClick={() => m.mutate({ id: p.id, decision: 'approve' })}><CheckCircle2 className="h-4 w-4" />{t('admin.approve')}</Button>}
                  {['pending_review', 'active', 'out_of_stock'].includes(p.status) && <Button size="sm" variant="outline" onClick={() => setAct({ p, decision: p.status === 'pending_review' ? 'reject' : 'deactivate' })}><XCircle className="h-4 w-4" />{p.status === 'pending_review' ? t('admin.reject') : t('seller.hide')}</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
      <Modal open={Boolean(act)} onClose={() => setAct(null)} title={act?.p.name} footer={<Button variant="danger" disabled={reason.length < 3} loading={m.isPending} onClick={() => m.mutate({ id: act!.p.id, decision: act!.decision, reason })}>{t('common.confirm')}</Button>}>
        <Field label={t('common.reason')}><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

