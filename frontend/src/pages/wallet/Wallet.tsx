import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpRight, CheckCircle2, Clock, Coins, Headset, Info, Landmark, Send, Wallet as WalletIcon, XCircle } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useErrorText } from '@/hooks';
import { useToast } from '@/store/toast';
import { cx, dateTime, money } from '@/utils/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Pagination, Skeleton, Tabs, Textarea } from '@/components/ui';
import { PageHeader, StatCard } from '@/components/common';
import { CardFace, useCards } from '@/components/Cards';

interface Tx { id: string; kind: string; amount: string; status: 'pending' | 'completed' | 'failed'; note: string | null; cardMasked: string | null; createdAt: string; user?: { fullName: string; phone: string; sellerProfile: { farmName: string } | null } }
interface WalletData { balance: { available: string; pendingWithdrawals: string; totalEarned: string }; transactions: Tx[]; minWithdraw: number }

const STATUS_TONE = { pending: 'yellow', completed: 'green', failed: 'red' } as const;

function TxRow({ x }: { x: Tx }) {
  const { t, lang } = useI18n();
  const neg = Number(x.amount) < 0;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', neg ? 'bg-red-50 text-danger' : 'bg-brand-50 text-brand')}>
        {neg ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownToLine className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{t(`y.wallet.k_${x.kind}` as TKey)}{x.cardMasked ? ` · ${x.cardMasked}` : ''}</p>
        <p className="truncate text-xs text-muted">{dateTime(x.createdAt, lang)}{x.note ? ` · ${x.note}` : ''}</p>
      </div>
      <div className="text-right">
        <p className={cx('font-extrabold', neg ? 'text-danger' : 'text-brand')}>{neg ? '' : '+'}{money(x.amount, lang)}</p>
        <Badge tone={STATUS_TONE[x.status]} className="mt-0.5">{t(`y.wallet.s_${x.status}` as TKey)}</Badge>
      </div>
    </li>
  );
}

export function WalletPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['wallet', page], queryFn: () => api.page<WalletData>(`/wallet?page=${page}&limit=15`) });
  const cards = useCards();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState<string | null>(null);
  const data = q.data?.data as unknown as WalletData | undefined;
  const meta = q.data?.meta;
  const w = useMutation({
    mutationFn: () => api.post('/wallet/withdraw', { amount: Number(amount), cardId }),
    onSuccess: () => {
      setOpen(false);
      setAmount('');
      toast(t('y.wallet.done'));
      void qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const avail = Number(data?.balance.available ?? 0);
  const chosen = cardId ?? cards.data?.find((c) => c.isDefault)?.id ?? cards.data?.[0]?.id ?? null;
  return (
    <div>
      <PageHeader title={t('y.wallet.title')} subtitle={t('y.wallet.subtitle')} actions={<Button disabled={avail < (data?.minWithdraw ?? 10000)} onClick={() => { setCardId(chosen); setOpen(true); }}><Landmark className="h-4 w-4" />{t('y.wallet.withdraw')}</Button>} />
      {q.isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <div className="relative mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 p-6 text-white shadow-card">
            <span className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-sun/20 blur-2xl" aria-hidden />
            <p className="flex items-center gap-2 text-sm font-semibold text-white/80"><WalletIcon className="h-4 w-4" />{t('y.wallet.available')}</p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{money(data.balance.available, lang)}</p>
            <p className="mt-2 text-xs text-white/70">{t('y.wallet.min', { min: money(data.minWithdraw, lang) })}</p>
          </div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <StatCard icon={<Coins className="h-5 w-5" />} label={t('y.wallet.earned')} value={money(data.balance.totalEarned, lang)} />
            <StatCard icon={<Clock className="h-5 w-5" />} tone="yellow" label={t('y.wallet.pending')} value={money(data.balance.pendingWithdrawals, lang)} />
          </div>
          <Card className="mb-5 flex gap-3 bg-cream-100 p-4 text-sm text-ink-soft">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <div><p className="font-bold text-ink">{t('y.wallet.how')}</p><p className="mt-1">{t('y.wallet.howText')}</p></div>
          </Card>
          <Card className="p-4 sm:p-5">
            <h2 className="mb-1 font-extrabold text-ink">{t('y.wallet.history')}</h2>
            {!data.transactions.length ? <Empty title={t('y.wallet.empty')} /> : <ul className="divide-y divide-cream-200">{data.transactions.map((x) => <TxRow key={x.id} x={x} />)}</ul>}
            {meta && meta.pages > 1 && <Pagination page={page} pages={meta.pages} onChange={setPage} />}
          </Card>
        </>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('y.wallet.withdraw')}
        footer={<Button block loading={w.isPending} disabled={!chosen || !cards.data?.length || Number(amount) < (data?.minWithdraw ?? 10000) || Number(amount) > avail} onClick={() => w.mutate()}><Send className="h-4 w-4" />{t('y.wallet.withdraw')}</Button>}
      >
        <Field label={t('y.wallet.amount')} hint={t('y.wallet.min', { min: money(data?.minWithdraw ?? 10000, lang) })}>
          <div className="flex gap-2">
            <Input type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button variant="outline" onClick={() => setAmount(String(Math.floor(avail)))}>MAX</Button>
          </div>
        </Field>
        <p className="mb-2 mt-4 text-sm font-bold">{t('y.wallet.toCard')}</p>
        {!cards.data?.length ? (
          <p className="rounded-xl bg-sun-100 px-3 py-2 text-sm text-amber-800">{t('y.wallet.noCard')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{cards.data.map((c) => <CardFace key={c.id} card={c} compact selected={c.id === cardId} onClick={() => setCardId(c.id)} />)}</div>
        )}
      </Modal>
    </div>
  );
}

// ───────── Admin: yechib olish so'rovlari ─────────
export function AdminWallet() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [status, setStatus] = useState<'pending' | 'completed' | 'failed'>('pending');
  const sum = useQuery({ queryKey: ['wallet', 'admin', 'summary'], queryFn: () => api.get<{ payouts: string; commission: string; withdrawn: string; pendingAmount: string; pendingCount: number }>('/wallet/admin/summary') });
  const list = useQuery({ queryKey: ['wallet', 'admin', status], queryFn: () => api.get<Tx[]>(`/wallet/admin/withdrawals?status=${status}`) });
  const [rej, setRej] = useState<Tx | null>(null);
  const [reason, setReason] = useState('');
  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'approve' | 'reject'; reason?: string }) => api.post(`/wallet/admin/withdrawals/${id}/${action}`, { reason }),
    onSuccess: () => {
      setRej(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['wallet', 'admin'] });
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const s = sum.data;
  return (
    <div>
      <PageHeader title={t('y.wallet.adminTitle')} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ArrowDownToLine className="h-5 w-5" />} label={t('y.wallet.payouts')} value={s ? money(s.payouts, lang) : '…'} />
        <StatCard icon={<Coins className="h-5 w-5" />} tone="lime" label={t('y.wallet.commissionTotal')} value={s ? money(s.commission, lang) : '…'} />
        <StatCard icon={<Landmark className="h-5 w-5" />} tone="blue" label={t('y.wallet.withdrawn')} value={s ? money(s.withdrawn, lang) : '…'} />
        <StatCard icon={<Clock className="h-5 w-5" />} tone="yellow" label={t('y.wallet.pendingReq')} value={s ? `${s.pendingCount} · ${money(s.pendingAmount, lang)}` : '…'} />
      </div>
      <Tabs className="mb-4" value={status} onChange={setStatus} items={(['pending', 'completed', 'failed'] as const).map((v) => ({ value: v, label: t(`y.wallet.s_${v}` as TKey) }))} />
      {list.isLoading ? <Skeleton className="h-32" /> : !list.data?.length ? <Card className="p-6"><Empty title={t('y.wallet.noRequests')} /></Card> : (
        <div className="space-y-3">
          {list.data.map((x) => (
            <Card key={x.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{x.user?.sellerProfile?.farmName ?? x.user?.fullName}</p>
                <p className="text-xs text-muted">{x.user?.fullName} · {x.user?.phone} · {dateTime(x.createdAt, lang)}</p>
                <p className="text-xs text-muted">{x.cardMasked}{x.note ? ` · ${x.note}` : ''}</p>
              </div>
              <p className="text-lg font-extrabold text-ink">{money(String(-Number(x.amount)), lang)}</p>
              {x.status === 'pending' ? (
                <div className="flex gap-2">
                  <Button size="sm" loading={act.isPending} onClick={() => act.mutate({ id: x.id, action: 'approve' })}><CheckCircle2 className="h-4 w-4" />{t('y.wallet.approve')}</Button>
                  <Button size="sm" variant="outline" onClick={() => setRej(x)}><XCircle className="h-4 w-4" />{t('y.wallet.rejectBtn')}</Button>
                </div>
              ) : <Badge tone={STATUS_TONE[x.status]}>{t(`y.wallet.s_${x.status}` as TKey)}</Badge>}
            </Card>
          ))}
        </div>
      )}
      <Modal open={!!rej} onClose={() => setRej(null)} title={t('y.wallet.rejectBtn')} footer={<Button block variant="danger" loading={act.isPending} onClick={() => rej && act.mutate({ id: rej.id, action: 'reject', reason: reason || undefined })}>{t('y.wallet.rejectBtn')}</Button>}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}

// ───────── Admin bilan bog'lanish (xaridor va fermer) ─────────
export function ContactAdmin() {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>('/conversations/support', { message: { body: text.trim() } }),
    onSuccess: (r) => {
      toast(t('y.support.sent'));
      nav(`/messages/${r.conversationId}`);
    },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <div className="max-w-2xl">
      <PageHeader title={t('y.support.title')} />
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white"><Headset className="h-6 w-6" /></span>
          <div><p className="font-extrabold text-ink">{t('y.support.name')}</p><p className="mt-1 text-sm text-ink-soft">{t('y.support.text')}</p></div>
        </div>
        <Textarea rows={5} value={text} maxLength={2000} placeholder={t('y.support.placeholder')} onChange={(e) => setText(e.target.value)} />
        <Button className="mt-3" loading={m.isPending} disabled={text.trim().length < 2} onClick={() => m.mutate()}><Send className="h-4 w-4" />{t('y.support.send')}</Button>
      </Card>
    </div>
  );
}

/** Admin yoki fermer — tanlangan foydalanuvchiga birinchi xabar */
export function WriteToModal({ open, onClose, name, endpoint }: { open: boolean; onClose: () => void; name: string; endpoint: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const nav = useNavigate();
  const [text, setText] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<{ conversationId: string }>(endpoint, { message: { body: text.trim() } }),
    onSuccess: (r) => {
      onClose();
      nav(`/messages/${r.conversationId}`);
    },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Modal open={open} onClose={onClose} title={t('y.support.writeTo', { name })} footer={<Button block loading={m.isPending} disabled={text.trim().length < 2} onClick={() => m.mutate()}><Send className="h-4 w-4" />{t('y.support.send')}</Button>}>
      <Textarea rows={4} autoFocus value={text} placeholder={t('y.support.placeholder')} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

