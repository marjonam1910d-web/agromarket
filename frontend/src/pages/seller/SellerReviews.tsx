import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { api } from '@/services/api';
import { date } from '@/utils/format';
import { Button, Card, Empty, Modal, Pagination, Skeleton, Stars, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/common';
/* ═════════ Sharhlar ═════════ */
export function SellerReviews() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['seller', 'reviews', page], queryFn: () => api.page<{ id: string; rating: number; text: string | null; sellerReply: string | null; createdAt: string; product: { name: string }; buyer: { fullName: string } }[]>(`/reviews/seller?page=${page}`) });
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null);
  const m = useMutation({ mutationFn: () => api.post(`/reviews/${reply!.id}/reply`, { reply: reply!.text }), onSuccess: () => { setReply(null); void qc.invalidateQueries({ queryKey: ['seller', 'reviews'] }); } });
  return (
    <div>
      <PageHeader title={t('seller.reviews')} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.data.length ? <Empty title={t('product.noReviews')} /> : (
        <div className="space-y-3">
          {q.data.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex justify-between"><p className="font-bold">{r.product.name}</p><span className="text-xs text-muted">{date(r.createdAt, lang)}</span></div>
              <div className="flex items-center gap-2 text-sm"><Stars value={r.rating} size={13} /><span className="text-muted">{r.buyer.fullName}</span></div>
              {r.text && <p className="mt-1 text-sm">{r.text}</p>}
              {r.sellerReply ? <p className="mt-2 rounded-lg bg-cream-100 px-3 py-2 text-sm"><b>{t('product.sellerReply')}:</b> {r.sellerReply}</p> : <Button size="sm" variant="ghost" className="mt-2" onClick={() => setReply({ id: r.id, text: '' })}>{t('seller.reply')}</Button>}
            </Card>
          ))}
          <Pagination page={page} pages={q.data.meta.pages} onChange={setPage} />
        </div>
      )}
      <Modal open={Boolean(reply)} onClose={() => setReply(null)} title={t('seller.reply')} footer={<Button loading={m.isPending} disabled={(reply?.text.length ?? 0) < 2} onClick={() => m.mutate()}>{t('common.submit')}</Button>}>
        <Textarea value={reply?.text ?? ''} onChange={(e) => setReply(reply && { ...reply, text: e.target.value })} />
      </Modal>
    </div>
  );
}

