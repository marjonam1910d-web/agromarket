import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, MessageCircle, ShieldCheck, ShoppingBag, Sprout, UserPlus, UserX, Warehouse } from 'lucide-react';
import { WriteToModal } from '@/pages/wallet/Wallet';
import { useI18n } from '@/i18n';
import { api, qs } from '@/services/api';
import { useToast } from '@/store/toast';
import { useDebounce, useErrorText } from '@/hooks';
import { date, phone } from '@/utils/format';
import { Badge, Button, Empty, Input, Pagination, Select, Skeleton, Table, Tabs } from '@/components/ui';
import { cx } from '@/utils/format';
import { PageHeader } from '@/components/common';
import { useRegions } from '@/hooks';
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
  const [write, setWrite] = useState<UserRow | null>(null);
  const { regionName } = useRegions();
  const st = useQuery({ queryKey: ['admin', 'users', 'stats'], queryFn: () => api.get<{ roles: Record<string, number>; statuses: Record<string, number>; sellerVerification: Record<string, number>; sellerRegions: Record<string, number>; newThisWeek: number; wholesaleBuyers: number }>('/admin/users/stats') });
  const s = st.data;
  const total = s ? Object.values(s.roles).reduce((a, b) => a + b, 0) : 0;
  const tiles = s ? [
    { icon: ShoppingBag, label: t('y.users.buyers'), value: s.roles.BUYER ?? 0, onClick: () => { setRole('BUYER'); setStatus(''); setPage(1); }, tone: 'bg-brand-50 text-brand' },
    { icon: Sprout, label: t('y.users.sellers'), value: s.roles.SELLER ?? 0, hint: `${t('y.users.verified')}: ${s.sellerVerification.APPROVED ?? 0} · ${t('y.users.pendingV')}: ${s.sellerVerification.PENDING ?? 0}`, onClick: () => { setRole('SELLER'); setStatus(''); setPage(1); }, tone: 'bg-lime-100 text-lime-700' },
    { icon: ShieldCheck, label: t('y.users.admins'), value: s.roles.ADMIN ?? 0, onClick: () => { setRole('ADMIN'); setStatus(''); setPage(1); }, tone: 'bg-ink/5 text-ink' },
    { icon: Warehouse, label: t('y.users.wholesale'), value: s.wholesaleBuyers, tone: 'bg-sun-100 text-amber-700' },
    { icon: UserX, label: t('y.users.blocked'), value: s.statuses.BLOCKED ?? 0, onClick: () => { setRole(''); setStatus('BLOCKED'); setPage(1); }, tone: 'bg-red-50 text-danger' },
    { icon: UserPlus, label: t('y.users.newWeek'), value: s.newThisWeek, tone: 'bg-sky-50 text-sky-700' },
  ] : [];
  const regions = s ? Object.entries(s.sellerRegions).sort((a, b) => b[1] - a[1]) : [];
  const m = useMutation({ mutationFn: (v: { id: string; status: string }) => api.patch(`/admin/users/${v.id}/status`, { status: v.status }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'users'] }); toast(t('common.saved')); }, onError: (e) => toast(err(e), 'error') });
  return (
    <div>
      <PageHeader title={t('admin.users')} subtitle={t('y.users.byCategory')} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!s ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />) : tiles.map((x) => (
          <button key={x.label} type="button" disabled={!x.onClick} onClick={x.onClick} className="rounded-2xl bg-white p-3 text-left ring-1 ring-cream-200 transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-card disabled:cursor-default">
            <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', x.tone)}><x.icon className="h-5 w-5" /></span>
            <p className="mt-2 text-2xl font-extrabold text-ink">{x.value}</p>
            <p className="text-xs font-semibold text-muted">{x.label}</p>
            {x.hint && <p className="mt-0.5 text-[10.5px] text-muted">{x.hint}</p>}
          </button>
        ))}
      </div>
      {regions.length > 0 && (
        <div className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-cream-200">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{t('y.users.byRegion')}</p>
          <div className="flex flex-wrap gap-1.5">{regions.map(([r, n]) => <span key={r} className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-soft">{regionName(r)} · <b className="text-brand">{n}</b></span>)}</div>
        </div>
      )}
      <Tabs className="mb-3" value={role || 'all'} onChange={(v) => { setRole(v === 'all' ? '' : v); setPage(1); }} items={[
        { value: 'all', label: t('y.users.all'), count: total },
        { value: 'BUYER', label: t('y.users.buyers'), count: s?.roles.BUYER },
        { value: 'SELLER', label: t('y.users.sellers'), count: s?.roles.SELLER },
        { value: 'ADMIN', label: t('y.users.admins'), count: s?.roles.ADMIN },
      ]} />
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
            { key: 'w', title: '', render: (u) => u.role !== 'ADMIN' && <Button size="sm" variant="outline" onClick={() => setWrite(u)}><MessageCircle className="h-4 w-4" />{t('y.support.writeUser')}</Button> },
            { key: 'a', title: '', render: (u) => u.role !== 'ADMIN' && (u.status === 'ACTIVE'
              ? <Button size="sm" variant="ghost" onClick={() => confirm(`${t('admin.block')}: ${u.fullName}?`) && m.mutate({ id: u.id, status: 'BLOCKED' })}><Ban className="h-4 w-4 text-danger" />{t('admin.block')}</Button>
              : <Button size="sm" variant="ghost" onClick={() => m.mutate({ id: u.id, status: 'ACTIVE' })}><CheckCircle2 className="h-4 w-4 text-brand" />{t('admin.unblock')}</Button>) },
          ]} />
          <Pagination page={page} pages={q.data?.meta.pages ?? 1} onChange={setPage} />
        </>
      )}
      {write && <WriteToModal open onClose={() => setWrite(null)} name={write.sellerProfile?.farmName ?? write.fullName} endpoint={`/conversations/admin/${write.id}`} />}
    </div>
  );
}

