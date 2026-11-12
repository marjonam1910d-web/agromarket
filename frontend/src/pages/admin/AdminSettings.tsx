import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText } from '@/hooks';
import { date, money } from '@/utils/format';
import { Button, Card, Checkbox, Field, Input, Modal, Select, Skeleton, Table } from '@/components/ui';
import { IntegrationsPanel } from '@/components/PayBrand';
type SettingsData = { values: Record<string, unknown>; integrations: { payments: Record<string, string>; channels: Record<string, string> } };
export const useAdminSettings = () => useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<SettingsData>('/admin/settings') });

/** Sozlamalar → Integratsiyalar */
export function AdminIntegrations() {
  const q = useAdminSettings();
  if (q.isLoading || !q.data) return <Skeleton className="h-40" />;
  return <IntegrationsPanel data={q.data.integrations} />;
}

/* ═════════ Platforma sozlamalari va kuponlar (Sozlamalar sahifasining admin bo'limlari) ═════════ */
export function AdminSettings({ part }: { part: 'platform' | 'coupons' }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useAdminSettings();
  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => api.get<{ id: string; code: string; type: string; value: string; usedCount: number; usageLimit: number | null; endsAt: string; isActive: boolean; seller: { farmName: string } | null }[]>('/admin/coupons') });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (v: { key: string; value: unknown }) => api.put(`/admin/settings/${v.key}`, { value: v.value }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const toggleCoupon = useMutation({ mutationFn: (v: { id: string; isActive: boolean }) => api.patch(`/admin/coupons/${v.id}`, { isActive: v.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }) });
  const [newC, setNewC] = useState<{ code: string; type: string; value: string; minOrderAmount: string; maxDiscount: string; usageLimit: string; startsAt: string; endsAt: string } | null>(null);
  const createC = useMutation({ mutationFn: () => api.post('/admin/coupons', { ...newC, value: Number(newC!.value), minOrderAmount: Number(newC!.minOrderAmount || 0), maxDiscount: newC!.maxDiscount ? Number(newC!.maxDiscount) : null, usageLimit: newC!.usageLimit ? Number(newC!.usageLimit) : null }), onSuccess: () => { setNewC(null); void coupons.refetch(); }, onError: (e) => toast(err(e), 'error') });
  if (q.isLoading) return <Skeleton className="h-96" />;
  const v = q.data!.values;
  const val = (k: string) => draft[k] ?? (Array.isArray(v[k]) ? (v[k] as string[]).join(', ') : String(v[k]));
  const row = (key: string, label: TKey, type: 'number' | 'text' | 'list' | 'bool') => (
    <div key={key} className="flex flex-col gap-2 border-b border-cream-100 py-3 last:border-0 sm:flex-row sm:items-center">
      <span className="flex-1 text-sm font-semibold">{t(label)}</span>
      {type === 'bool' ? (
        <Checkbox checked={Boolean(v[key])} onChange={(e) => save.mutate({ key, value: e.target.checked })} label={Boolean(v[key]) ? t('common.yes') : t('common.no')} />
      ) : (
        <div className="flex gap-2">
          <Input value={val(key)} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="w-56" />
          <Button size="sm" variant="secondary" onClick={() => save.mutate({ key, value: type === 'number' ? Number(val(key)) : type === 'list' ? val(key).split(',').map((s) => s.trim()).filter(Boolean) : val(key) })}>{t('common.save')}</Button>
        </div>
      )}
    </div>
  );
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-5">
      {part === 'platform' && <Card className="p-5">
        {row('commission.percent', 'admin.commissionPercent', 'number')}
        {row('products.autoApprove', 'admin.autoApprove', 'bool')}
        {row('delivery.slots', 'admin.slots', 'list')}
        {row('delivery.maxDaysAhead', 'admin.maxDays', 'number')}
        {row('reviews.autoHideReports', 'admin.autoHide', 'number')}
        {row('platform.supportPhone', 'admin.supportPhone', 'text')}
        {row('partner.deliverySharePercent', 'z.settings.partnerShare', 'number')}
      </Card>}
      {part === 'coupons' && <Card className="p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-extrabold">{t('admin.coupons')}</h2><Button size="sm" onClick={() => setNewC({ code: '', type: 'percent', value: '10', minOrderAmount: '0', maxDiscount: '', usageLimit: '', startsAt: today, endsAt: today })}><Plus className="h-4 w-4" />{t('common.add')}</Button></div>
        <Table rows={coupons.data ?? []} rowKey={(c) => c.id} empty={<p className="text-sm text-muted">{t('common.empty')}</p>} columns={[
          { key: 'c', title: t('seller.couponCode'), render: (c) => <b className="font-mono">{c.code}</b> },
          { key: 'o', title: t('admin.sellers'), render: (c) => c.seller?.farmName ?? 'AgroMarket' },
          { key: 'v', title: t('seller.value'), render: (c) => (c.type === 'percent' ? `${Number(c.value)}%` : money(c.value, lang)) },
          { key: 'u', title: t('seller.usageLimit'), render: (c) => `${c.usedCount}/${c.usageLimit ?? '∞'}` },
          { key: 'e', title: t('seller.endsAt'), render: (c) => date(c.endsAt, lang) },
          { key: 'a', title: '', render: (c) => <Checkbox checked={c.isActive} onChange={(e) => toggleCoupon.mutate({ id: c.id, isActive: e.target.checked })} label={t('admin.active')} /> },
        ]} />
      </Card>}
      <Modal open={Boolean(newC)} onClose={() => setNewC(null)} title={t('admin.coupons')} footer={<Button loading={createC.isPending} onClick={() => createC.mutate()}>{t('common.save')}</Button>}>
        {newC && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('seller.couponCode')} className="col-span-2"><Input value={newC.code} onChange={(e) => setNewC({ ...newC, code: e.target.value.toUpperCase() })} /></Field>
            <Field label={t('seller.couponType')}><Select value={newC.type} onChange={(e) => setNewC({ ...newC, type: e.target.value })}><option value="percent">{t('seller.percentType')}</option><option value="fixed">{t('seller.fixedType')}</option></Select></Field>
            <Field label={t('seller.value')}><Input type="number" value={newC.value} onChange={(e) => setNewC({ ...newC, value: e.target.value })} /></Field>
            <Field label={t('seller.minAmount')}><Input type="number" value={newC.minOrderAmount} onChange={(e) => setNewC({ ...newC, minOrderAmount: e.target.value })} /></Field>
            <Field label="Max"><Input type="number" value={newC.maxDiscount} onChange={(e) => setNewC({ ...newC, maxDiscount: e.target.value })} /></Field>
            <Field label={t('seller.usageLimit')}><Input type="number" value={newC.usageLimit} onChange={(e) => setNewC({ ...newC, usageLimit: e.target.value })} /></Field>
            <div />
            <Field label={t('seller.startsAt')}><Input type="date" value={newC.startsAt} onChange={(e) => setNewC({ ...newC, startsAt: e.target.value })} /></Field>
            <Field label={t('seller.endsAt')}><Input type="date" value={newC.endsAt} onChange={(e) => setNewC({ ...newC, endsAt: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

