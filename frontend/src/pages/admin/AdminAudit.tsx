import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useI18n } from '@/i18n';
import { qs } from '@/services/api';
import { useDebounce } from '@/hooks';
import { dateTime } from '@/utils/format';
import { Badge, Empty, Input, Pagination, Skeleton, Table } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ Audit log ═════════ */
export function AdminAudit() {
  const { t, lang } = useI18n();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(action);
  const q = usePaged<{ id: string; action: string; entityType: string; entityId: string | null; meta: unknown; ip: string | null; createdAt: string; actor: { fullName: string; role: string } | null }[]>(['admin', 'audit', dq, page], `/admin/audit-logs${qs({ action: dq, page })}`);
  return (
    <div>
      <PageHeader title={t('admin.audit')} actions={<Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder={t('admin.action')} className="w-56" />} />
      {q.isLoading ? <Skeleton className="h-60" /> : (
        <>
          <Table rows={q.data?.data ?? []} rowKey={(r) => r.id} empty={<Empty icon={<ClipboardList className="h-7 w-7" />} title={t('common.empty')} />} columns={[
            { key: 'd', title: t('common.date'), render: (r) => <span className="text-xs">{dateTime(r.createdAt, lang)}</span> },
            { key: 'a', title: t('admin.actor'), render: (r) => (r.actor ? `${r.actor.fullName} (${r.actor.role})` : 'SYSTEM') },
            { key: 'x', title: t('admin.action'), render: (r) => <Badge tone="blue">{r.action}</Badge> },
            { key: 'e', title: t('admin.entity'), render: (r) => <span className="font-mono text-xs">{r.entityType}:{r.entityId?.slice(0, 10)}</span> },
            { key: 'm', title: 'Meta', render: (r) => <span className="line-clamp-2 max-w-xs font-mono text-[11px] text-muted">{r.meta ? JSON.stringify(r.meta) : ''}</span>, mobile: false },
            { key: 'ip', title: 'IP', render: (r) => <span className="text-xs text-muted">{r.ip}</span>, mobile: false },
          ]} />
          <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
