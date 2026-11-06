import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { date, money } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, Select, Table } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { MyProduct } from './shared';
/* ═════════ Aksiyalar va kuponlar ═════════ */
export function Promotions() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const promos = useQuery({ queryKey: ['seller', 'promos'], queryFn: () => api.get<{ id: string; title: string; discountPercent: number; startsAt: string; endsAt: string; isActive: boolean; products: { id: string; name: string }[] }[]>('/sellers/me/promotions') });
  const coupons = useQuery({ queryKey: ['seller', 'coupons'], queryFn: () => api.get<{ id: string; code: string; type: string; value: string; usedCount: number; usageLimit: number | null; endsAt: string; isActive: boolean }[]>('/sellers/me/coupons') });
  const products = useQuery({ queryKey: ['seller', 'products', 'all'], queryFn: () => api.get<MyProduct[]>('/products/mine?limit=100') });
  const today = new Date().toISOString().slice(0, 10);
  const [p, setP] = useState<{ title: string; discountPercent: string; startsAt: string; endsAt: string; productIds: string[] } | null>(null);
  const [c, setC] = useState<{ code: string; type: 'percent' | 'fixed'; value: string; minOrderAmount: string; usageLimit: string; startsAt: string; endsAt: string } | null>(null);
  const saveP = useMutation({ mutationFn: () => api.post('/sellers/me/promotions', { ...p, discountPercent: Number(p!.discountPercent) }), onSuccess: () => { setP(null); void qc.invalidateQueries({ queryKey: ['seller'] }); }, onError: (e) => toast(err(e), 'error') });
  const delP = useMutation({ mutationFn: (id: string) => api.del(`/sellers/me/promotions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'promos'] }) });
  const saveC = useMutation({ mutationFn: () => api.post('/sellers/me/coupons', { ...c, value: Number(c!.value), minOrderAmount: Number(c!.minOrderAmount || 0), usageLimit: c!.usageLimit ? Number(c!.usageLimit) : null }), onSuccess: () => { setC(null); void qc.invalidateQueries({ queryKey: ['seller', 'coupons'] }); }, onError: (e) => toast(err(e), 'error') });
  const toggleC = useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => api.patch(`/sellers/me/coupons/${v.id}`, { isActive: v.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'coupons'] }) });
  return (
    <div className="space-y-8">
      <div>
        <PageHeader title={t('seller.promotions')} actions={<Button onClick={() => setP({ title: '', discountPercent: '10', startsAt: today, endsAt: today, productIds: [] })}><Plus className="h-4 w-4" />{t('common.add')}</Button>} />
        <div className="grid gap-3 sm:grid-cols-2">
          {promos.data?.map((x) => (
            <Card key={x.id} className="p-4">
              <div className="flex justify-between"><p className="font-bold">{x.title}</p><Badge tone="red">−{x.discountPercent}%</Badge></div>
              <p className="text-xs text-muted">{date(x.startsAt, lang)} — {date(x.endsAt, lang)}</p>
              <p className="mt-2 text-sm">{x.products.map((pp) => pp.name).join(', ')}</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => delP.mutate(x.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
            </Card>
          ))}
          {!promos.data?.length && <Empty title={t('common.empty')} />}
        </div>
      </div>
      <div>
        <PageHeader title={t('seller.couponCode')} actions={<Button variant="outline" onClick={() => setC({ code: '', type: 'percent', value: '10', minOrderAmount: '0', usageLimit: '', startsAt: today, endsAt: today })}><Plus className="h-4 w-4" />{t('common.add')}</Button>} />
        <Table rows={coupons.data ?? []} rowKey={(x) => x.id} empty={<Empty title={t('common.empty')} />} columns={[
          { key: 'c', title: t('seller.couponCode'), render: (x) => <b className="font-mono">{x.code}</b> },
          { key: 'v', title: t('seller.value'), render: (x) => (x.type === 'percent' ? `${Number(x.value)}%` : money(x.value, lang)) },
          { key: 'u', title: t('seller.usageLimit'), render: (x) => `${x.usedCount}/${x.usageLimit ?? '∞'}` },
          { key: 'e', title: t('seller.endsAt'), render: (x) => date(x.endsAt, lang) },
          { key: 'a', title: t('common.status'), render: (x) => <Checkbox checked={x.isActive} onChange={(e) => toggleC.mutate({ id: x.id, isActive: e.target.checked })} label={x.isActive ? t('admin.active') : t('admin.inactive')} /> },
        ]} />
      </div>
      <Modal open={Boolean(p)} onClose={() => setP(null)} title={t('seller.promotions')} footer={<Button loading={saveP.isPending} disabled={!p?.title || !p.productIds.length} onClick={() => saveP.mutate()}>{t('common.save')}</Button>}>
        {p && (
          <div className="space-y-3">
            <Field label={t('seller.promoTitle')}><Input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('seller.percent')}><Input type="number" min={1} max={90} value={p.discountPercent} onChange={(e) => setP({ ...p, discountPercent: e.target.value })} /></Field>
              <Field label={t('seller.startsAt')}><Input type="date" value={p.startsAt} onChange={(e) => setP({ ...p, startsAt: e.target.value })} /></Field>
              <Field label={t('seller.endsAt')}><Input type="date" value={p.endsAt} onChange={(e) => setP({ ...p, endsAt: e.target.value })} /></Field>
            </div>
            <p className="text-sm font-semibold">{t('seller.selectProducts')}</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl bg-cream-50 p-3">
              {products.data?.map((pp) => <Checkbox key={pp.id} checked={p.productIds.includes(pp.id)} onChange={(e) => setP({ ...p, productIds: e.target.checked ? [...p.productIds, pp.id] : p.productIds.filter((x) => x !== pp.id) })} label={pp.name} />)}
            </div>
          </div>
        )}
      </Modal>
      <Modal open={Boolean(c)} onClose={() => setC(null)} title={t('seller.couponCode')} footer={<Button loading={saveC.isPending} disabled={!c?.code} onClick={() => saveC.mutate()}>{t('common.save')}</Button>}>
        {c && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('seller.couponCode')} className="col-span-2"><Input value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} /></Field>
            <Field label={t('seller.couponType')}><Select value={c.type} onChange={(e) => setC({ ...c, type: e.target.value as 'percent' })}><option value="percent">{t('seller.percentType')}</option><option value="fixed">{t('seller.fixedType')}</option></Select></Field>
            <Field label={t('seller.value')}><Input type="number" value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} /></Field>
            <Field label={t('seller.minAmount')}><Input type="number" value={c.minOrderAmount} onChange={(e) => setC({ ...c, minOrderAmount: e.target.value })} /></Field>
            <Field label={t('seller.usageLimit')}><Input type="number" value={c.usageLimit} onChange={(e) => setC({ ...c, usageLimit: e.target.value })} /></Field>
            <Field label={t('seller.startsAt')}><Input type="date" value={c.startsAt} onChange={(e) => setC({ ...c, startsAt: e.target.value })} /></Field>
            <Field label={t('seller.endsAt')}><Input type="date" value={c.endsAt} onChange={(e) => setC({ ...c, endsAt: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

