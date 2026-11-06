import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { api, qs } from '@/services/api';
import { date } from '@/utils/format';
import { Badge, Button, Card, Empty, Pagination, Skeleton, Stars, Tabs } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { usePaged } from './shared';
/* ═════════ Sharhlar moderatsiyasi ═════════ */
export function AdminReviews() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [reported, setReported] = useState('true');
  const [page, setPage] = useState(1);
  const q = usePaged<{ id: string; rating: number; text: string | null; status: string; reportCount: number; createdAt: string; product: { name: string }; buyer: { fullName: string }; reports: { reason: string }[] }[]>(['admin', 'reviews', reported, page], `/admin/reviews${qs({ reported, page })}`);
  const m = useMutation({ mutationFn: (v: { id: string; status: string }) => api.patch(`/admin/reviews/${v.id}`, { status: v.status }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reviews'] }) });
  return (
    <div>
      <PageHeader title={t('admin.reviews')} />
      <Tabs className="mb-4" value={reported} onChange={(v) => { setReported(v); setPage(1); }} items={[{ value: 'true', label: `⚑ ${t('admin.reports')}` }, { value: '', label: t('common.all') }]} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.data.length ? <Empty title={t('common.empty')} /> : (
        <div className="space-y-3">
          {q.data.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-2"><p className="font-bold">{r.product.name}</p><Badge tone={r.status === 'published' ? 'green' : 'gray'}>{r.status}</Badge></div>
              <p className="flex items-center gap-2 text-xs text-muted"><Stars value={r.rating} size={11} />{r.buyer.fullName} · {date(r.createdAt, lang)}{r.reportCount > 0 && <Badge tone="red">{r.reportCount} {t('admin.reports')}</Badge>}</p>
              {r.text && <p className="mt-1 text-sm">{r.text}</p>}
              {r.reports.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-danger">{r.reports.map((x, i) => <li key={i}>{x.reason}</li>)}</ul>}
              <div className="mt-2">{r.status === 'published' ? <Button size="sm" variant="outline" onClick={() => m.mutate({ id: r.id, status: 'hidden' })}>{t('admin.hideReview')}</Button> : <Button size="sm" onClick={() => m.mutate({ id: r.id, status: 'published' })}>{t('admin.publishReview')}</Button>}</div>
            </Card>
          ))}
          <Pagination page={page} pages={q.data.meta.pages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

