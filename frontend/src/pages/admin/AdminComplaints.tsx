import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { dateTime, phone } from '@/utils/format';
import { Button, Card, Empty, Field, Modal, Pagination, Select, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { usePaged } from './shared';
import { Gavel } from 'lucide-react';
import { IssueSanctionModal } from './Backoffice';
/* ═════════ Shikoyatlar ═════════ */
export function AdminComplaints() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const q = usePaged<{ id: string; subject: string; description: string; status: string; resolution: string | null; createdAt: string; reporter: { id: string; fullName: string; phone: string | null; role: string }; against: { id: string; fullName: string; role: string; sellerProfile: { farmName: string } | null } | null; order: { id: string; orderNumber: string } | null }[]>(['admin', 'complaints', status, page], `/admin/complaints${qs({ status, page })}`);
  const [edit, setEdit] = useState<{ id: string; status: string; resolution: string } | null>(null);
  const [act, setAct] = useState<{ complaintId: string; user: { id: string; name: string } } | null>(null);
  const m = useMutation({ mutationFn: () => api.patch(`/admin/complaints/${edit!.id}`, { status: edit!.status, resolution: edit!.resolution }), onSuccess: () => { setEdit(null); void qc.invalidateQueries({ queryKey: ['admin', 'complaints'] }); } });
  return (
    <div>
      <PageHeader title={t('admin.complaints')} />
      <Tabs className="mb-4" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={(['open', 'in_review', 'resolved', 'rejected', ''] as const).map((s) => ({ value: s, label: s ? t(`status.c_${s}` as TKey) : t('common.all') }))} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.data.length ? <Empty title={t('common.empty')} /> : (
        <div className="space-y-3">
          {q.data.data.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-bold">{c.subject}</p><StatusBadge status={c.status} kind="c" /></div>
              <p className="text-xs text-muted">{dateTime(c.createdAt, lang)} · {c.reporter.fullName} ({phone(c.reporter.phone)}){c.against && <> → <Link to={`/admin/users/${c.against.id}`} className="font-semibold text-brand">{c.against.sellerProfile?.farmName ?? c.against.fullName}</Link></>}{c.order && <> · <Link to={`/account/orders/${c.order.id}`} className="text-brand">#{c.order.orderNumber}</Link></>}</p>
              <p className="mt-2 text-sm">{c.description}</p>
              {c.resolution && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm">{c.resolution}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: c.id, status: c.status === 'open' ? 'in_review' : c.status, resolution: c.resolution ?? '' })}>{t('admin.resolve')}</Button>
                {c.against && c.against.role !== 'ADMIN' && ['open', 'in_review'].includes(c.status) && <Button size="sm" variant="danger" onClick={() => setAct({ complaintId: c.id, user: { id: c.against!.id, name: c.against!.sellerProfile?.farmName ?? c.against!.fullName } })}><Gavel className="h-4 w-4" />{t('z.sanction.issue')}</Button>}
                {c.reporter.role !== 'ADMIN' && <Link to={`/admin/users/${c.reporter.id}`}><Button size="sm" variant="ghost">{t('z.sanction.reporterCard')}</Button></Link>}
              </div>
            </Card>
          ))}
          <Pagination page={page} pages={q.data.meta.pages} onChange={setPage} />
        </div>
      )}
      {act && <IssueSanctionModal open onClose={() => setAct(null)} user={act.user} complaintId={act.complaintId} onDone={() => void qc.invalidateQueries({ queryKey: ['admin', 'complaints'] })} />}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={t('admin.resolve')} footer={<Button loading={m.isPending} onClick={() => m.mutate()}>{t('common.save')}</Button>}>
        {edit && (
          <div className="space-y-3">
            <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{['open', 'in_review', 'resolved', 'rejected'].map((s) => <option key={s} value={s}>{t(`status.c_${s}` as TKey)}</option>)}</Select>
            <Field label={t('admin.resolution')}><Textarea value={edit.resolution} onChange={(e) => setEdit({ ...edit, resolution: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

