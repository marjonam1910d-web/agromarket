import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { money } from '@/utils/format';
import { Badge, Button, Checkbox, Empty, Field, Input, Modal, Skeleton, Table } from '@/components/ui';
import { PageHeader, RegionDistrictSelect } from '@/components/common';
/* ═════════ Yetkazish zonalari ═════════ */
type Zone = { id: string; region: string; district: string | null; baseFee: string; perKgFee: string; freeFromAmount: string | null; minDays: number; maxDays: number; isActive: boolean };
export function DeliveryZones() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['seller', 'zones'], queryFn: () => api.get<Zone[]>('/deliveries/zones') });
  const blank = { region: '', district: null as string | null, baseFee: '20000', perKgFee: '500', freeFromAmount: '', minDays: '1', maxDays: '3', isActive: true };
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const b = { region: edit!.region, district: edit!.district, baseFee: Number(edit!.baseFee), perKgFee: Number(edit!.perKgFee), freeFromAmount: edit!.freeFromAmount ? Number(edit!.freeFromAmount) : null, minDays: Number(edit!.minDays), maxDays: Number(edit!.maxDays), isActive: edit!.isActive };
      return edit!.id ? api.put(`/deliveries/zones/${edit!.id}`, b) : api.post('/deliveries/zones', b);
    },
    onSuccess: () => { setEdit(null); void qc.invalidateQueries({ queryKey: ['seller', 'zones'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  const del = useMutation({ mutationFn: (id: string) => api.del(`/deliveries/zones/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['seller', 'zones'] }) });
  return (
    <div>
      <PageHeader title={t('seller.delivery')} actions={<Button onClick={() => setEdit(blank)}><Plus className="h-4 w-4" />{t('seller.addZone')}</Button>} />
      {q.isLoading ? <Skeleton className="h-40" /> : (
        <Table
          rows={q.data ?? []}
          rowKey={(z) => z.id}
          empty={<Empty icon={<Truck className="h-7 w-7" />} title={t('common.empty')} />}
          columns={[
            { key: 'r', title: t('common.region'), render: (z) => <b>{regionName(z.region)}{z.district ? ` · ${z.district}` : ` · ${t('seller.zoneAll')}`}</b> },
            { key: 'b', title: t('seller.baseFee'), render: (z) => money(z.baseFee, lang) },
            { key: 'k', title: t('seller.perKg'), render: (z) => money(z.perKgFee, lang) },
            { key: 'f', title: t('seller.freeFrom'), render: (z) => (z.freeFromAmount ? money(z.freeFromAmount, lang) : '—') },
            { key: 'd', title: t('seller.days'), render: (z) => `${z.minDays}–${z.maxDays}` },
            { key: 's', title: t('common.status'), render: (z) => <Badge tone={z.isActive ? 'green' : 'gray'}>{z.isActive ? t('admin.active') : t('admin.inactive')}</Badge> },
            { key: 'a', title: '', render: (z) => <div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => setEdit({ ...z, baseFee: z.baseFee, perKgFee: z.perKgFee, freeFromAmount: z.freeFromAmount ?? '', minDays: String(z.minDays), maxDays: String(z.maxDays) })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => del.mutate(z.id)}><Trash2 className="h-4 w-4 text-danger" /></Button></div> },
          ]}
        />
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={t('seller.addZone')} footer={<Button loading={save.isPending} disabled={!edit?.region} onClick={() => save.mutate()}>{t('common.save')}</Button>}>
        {edit && (
          <div className="space-y-3">
            <RegionDistrictSelect allowAllDistricts region={edit.region} district={edit.district} onChange={(r, d) => setEdit({ ...edit, region: r, district: d })} />
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('seller.baseFee')}><Input type="number" value={edit.baseFee} onChange={(e) => setEdit({ ...edit, baseFee: e.target.value })} /></Field>
              <Field label={t('seller.perKg')}><Input type="number" value={edit.perKgFee} onChange={(e) => setEdit({ ...edit, perKgFee: e.target.value })} /></Field>
              <Field label={t('seller.freeFrom')}><Input type="number" value={edit.freeFromAmount} onChange={(e) => setEdit({ ...edit, freeFromAmount: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t('seller.days')} min`}><Input type="number" value={edit.minDays} onChange={(e) => setEdit({ ...edit, minDays: e.target.value })} /></Field>
              <Field label={`${t('seller.days')} max`}><Input type="number" value={edit.maxDays} onChange={(e) => setEdit({ ...edit, maxDays: e.target.value })} /></Field>
            </div>
            <Checkbox checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} label={t('admin.active')} />
          </div>
        )}
      </Modal>
    </div>
  );
}

