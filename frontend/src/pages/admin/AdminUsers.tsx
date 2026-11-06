import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useDebounce, useErrorText } from '@/hooks';
import { date, phone } from '@/utils/format';
import { Badge, Button, Empty, Input, Pagination, Select, Skeleton, Table } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ Foydalanuvchilar ═════════ */
type UserRow = { id: string; fullName: string; email: string | null; phone: string | null; role: string; status: string; createdAt: string; lastLoginAt: string | null; sellerProfile: { farmName: string; verificationStatus: string } | null; _count: { orders: number } };
export function AdminUsers() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(search);
  const q = usePaged<UserRow[]>(['admin', 'users', dq, role, status, page], `/admin/users${qs({ q: dq, role, status, page })}`);
  const m = useMutation({ mutationFn: (v: { id: string; status: string }) => api.patch(`/admin/users/${v.id}/status`, { status: v.status }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast(t('common.saved')); }, onError: (e) => toast(err(e), 'error') });
  return (
    <div>
      <PageHeader title={t('admin.users')} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_160px]">
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('common.search')} />
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">{t('admin.role')}: {t('common.all')}</option><option value="BUYER">BUYER</option><option value="SELLER">SELLER</option><option value="ADMIN">ADMIN</option></Select>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">{t('common.status')}: {t('common.all')}</option><option value="ACTIVE">ACTIVE</option><option value="BLOCKED">BLOCKED</option></Select>
      </div>
      {q.isLoading ? <Skeleton className="h-60" /> : (
        <>
          <Table rows={q.data?.data ?? []} rowKey={(u) => u.id} empty={<Empty title={t('common.empty')} />} columns={[
            { key: 'n', title: t('common.name'), render: (u) => <div className="text-left"><p className="font-bold">{u.fullName}</p><p className="text-xs text-muted">{u.sellerProfile?.farmName}</p></div> },
            { key: 'c', title: t('common.phone'), render: (u) => <span className="text-sm">{phone(u.phone)}<br /><span className="text-xs text-muted">{u.email}</span></span> },
            { key: 'r', title: t('admin.role'), render: (u) => <Badge tone={u.role === 'ADMIN' ? 'dark' : u.role === 'SELLER' ? 'lime' : 'gray'}>{u.role}</Badge> },
            { key: 'o', title: t('admin.orders'), render: (u) => u._count.orders },
            { key: 'j', title: t('admin.joined'), render: (u) => date(u.createdAt, lang) },
            { key: 's', title: t('common.status'), render: (u) => <Badge tone={u.status === 'ACTIVE' ? 'green' : 'red'}>{u.status}</Badge> },
            { key: 'a', title: '', render: (u) => u.role !== 'ADMIN' && (u.status === 'ACTIVE'
              ? <Button size="sm" variant="ghost" onClick={() => confirm(`${t('admin.block')}: ${u.fullName}?`) && m.mutate({ id: u.id, status: 'BLOCKED' })}><Ban className="h-4 w-4 text-danger" />{t('admin.block')}</Button>
              : <Button size="sm" variant="ghost" onClick={() => m.mutate({ id: u.id, status: 'ACTIVE' })}><CheckCircle2 className="h-4 w-4 text-brand" />{t('admin.unblock')}</Button>) },
          ]} />
          <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}

