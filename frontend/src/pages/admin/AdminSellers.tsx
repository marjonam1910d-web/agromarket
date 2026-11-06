import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, FileText, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { date, phone } from '@/utils/format';
import { Button, Card, Empty, Field, Modal, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged, SellerRow } from './shared';
/* ═════════ Sotuvchilarni tekshirish ═════════ */
export function AdminSellers() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { regionName } = useRegions();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const q = usePaged<SellerRow[]>(['admin', 'sellers', status, page], `/admin/sellers${qs({ status, page })}`);
  const [reject, setReject] = useState<SellerRow | null>(null);
  const [note, setNote] = useState('');
  const m = useMutation({
    mutationFn: (v: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) => api.post(`/admin/sellers/${v.id}/verify`, { decision: v.decision, note: v.note }),
    onSuccess: () => { setReject(null); setNote(''); void qc.invalidateQueries({ queryKey: ['admin'] }); toast(t('common.saved')); },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div>
      <PageHeader title={t('admin.sellers')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={(['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED', ''] as const).map((s) => ({ value: s, label: s ? t(`status.ver_${s}` as TKey) : t('common.all') }))} />
      {q.isLoading ? <Skeleton className="h-60" /> : !q.data?.data.length ? <Empty title={t('common.empty')} /> : (
        <div className="space-y-3">
          {q.data.data.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start">
                <div className="flex-1">
                  <p className="flex items-center gap-2 font-extrabold">{s.farmName}<StatusBadge status={s.verificationStatus} kind="ver" /></p>
                  <p className="text-sm text-ink-soft">{s.user.fullName} · {phone(s.user.phone)} {s.user.email && `· ${s.user.email}`}</p>
                  <p className="text-sm text-muted">{regionName(s.region)}, {s.district}, {s.address}</p>
                  <p className="text-sm">STIR: <b>{s.tin ?? '—'}</b> · {t('seller.products')}: {s._count.products} · {t('admin.orders')}: {s._count.sellerOrders}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.verifications.map((v) => (
                      <a key={v.id} href={v.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-cream-100 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-50"><FileText className="h-3.5 w-3.5" />{t(`seller.doc_${v.documentType}` as TKey)} · {date(v.createdAt, lang)}</a>
                    ))}
                    {!s.verifications.length && <span className="text-xs text-muted">{t('status.ver_NOT_SUBMITTED')}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {s.verificationStatus !== 'APPROVED' && <Button size="sm" onClick={() => m.mutate({ id: s.id, decision: 'APPROVED' })} loading={m.isPending && m.variables?.id === s.id && m.variables.decision === 'APPROVED'}><BadgeCheck className="h-4 w-4" />{t('admin.approve')}</Button>}
                  {s.verificationStatus !== 'REJECTED' && <Button size="sm" variant="outline" onClick={() => setReject(s)}><XCircle className="h-4 w-4" />{t('admin.reject')}</Button>}
                </div>
              </div>
            </Card>
          ))}
          <Pagination page={page} pages={q.data.meta.pages} onChange={setPage} />
        </div>
      )}
      <Modal open={Boolean(reject)} onClose={() => setReject(null)} title={`${t('admin.reject')}: ${reject?.farmName}`} footer={<Button variant="danger" disabled={note.length < 3} loading={m.isPending} onClick={() => m.mutate({ id: reject!.id, decision: 'REJECTED', note })}>{t('common.confirm')}</Button>}>
        <Field label={t('common.reason')}><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

