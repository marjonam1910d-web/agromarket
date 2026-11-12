import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, CheckCheck, Headset, ImagePlus, Languages, Loader2, Send } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, img } from '@/services/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useConfig, useErrorText } from '@/hooks';
import { cx, dateTime, relative } from '@/utils/format';
import { Button, Card, Empty, Input, Pagination, Skeleton } from '@/components/ui';
import { PageHeader } from '@/components/common';
import type { Notification } from '@/types';

export function NotificationsPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['notifications', 'list', page], queryFn: () => api.page<Notification[]>(`/notifications?page=${page}`) });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const open = async (n: Notification) => {
    if (!n.readAt) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (n.link) nav(n.link);
  };
  return (
    <div>
      <PageHeader title={t('nav.notifications')} actions={<Button variant="outline" size="sm" onClick={() => readAll.mutate()}><CheckCheck className="h-4 w-4" />{t('account.markAllRead')}</Button>} />
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.data.length ? <Empty icon={<Bell className="h-7 w-7" />} title={t('account.noNotifications')} /> : (
        <>
          <Card className="divide-y divide-cream-200">
            {q.data.data.map((n) => (
              <button key={n.id} onClick={() => void open(n)} className={cx('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-cream-50', !n.readAt && 'bg-brand-50/40')}>
                <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand')} />
                <span className="flex-1">
                  <span className="block font-bold text-ink">{n.title}</span>
                  <span className="block text-sm text-ink-soft">{n.body}</span>
                  <span className="mt-0.5 block text-xs text-muted">{relative(n.createdAt, lang)}</span>
                </span>
              </button>
            ))}
          </Card>
          <Pagination page={page} pages={q.data.meta.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

type Conv = { id: string; lastMessage: { body: string; createdAt: string; senderId: string } | null; unread: number; role: string; counterpart: { id: string; name: string; avatarUrl: string | null }; lastMessageAt: string; kind?: 'TRADE' | 'SUPPORT' };
type Msg = { id: string; senderId: string; body: string; attachmentUrl: string | null; readAt: string | null; createdAt: string };

/** Suhbatdagi xabarni joriy tilga tarjima qilish (server tarjima xizmati sozlangan bo'lsa) */
function TranslatableBody({ body, mine }: { body: string; mine: boolean }) {
  const { t, lang } = useI18n();
  const cfg = useConfig();
  const [out, setOut] = useState<string | null>(null);
  const [showOrig, setShowOrig] = useState(false);
  const m = useMutation({ mutationFn: () => api.post<{ text: string }>('/conversations/translate', { text: body, to: lang }), onSuccess: (r) => setOut(r.text) });
  return (
    <>
      <p className="whitespace-pre-wrap break-words">{out && !showOrig ? out : body}</p>
      {cfg.data?.translate && !mine && (
        <button type="button" onClick={() => (out ? setShowOrig(!showOrig) : m.mutate())} className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-brand">
          {m.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          {out && !showOrig ? t('y.chat.original') : t('y.chat.translate')}
        </button>
      )}
    </>
  );
}

export function MessagesPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorText();
  const list = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conv[]>('/conversations'), refetchInterval: 30_000 });
  const thread = useQuery({
    queryKey: ['conversations', id],
    queryFn: () => api.get<{ conversation: { product: { name: string; slug: string } | null; order: { id: string; orderNumber: string } | null }; messages: Msg[] }>(`/conversations/${id}/messages`),
    enabled: Boolean(id),
    refetchInterval: 20_000,
  });
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.data?.messages.length]);
  useEffect(() => {
    if (thread.data) void qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
  }, [thread.data, qc]);
  const send = useMutation({
    mutationFn: (body: { body: string; attachmentUrl?: string }) => api.post(`/conversations/${id}/messages`, body),
    onSuccess: () => { setText(''); void qc.invalidateQueries({ queryKey: ['conversations'] }); },
    onError: (e) => toast(err(e), 'error'),
  });
  const attach = async (f: File | undefined) => {
    if (!f) return;
    const fd = new FormData();
    fd.append('files', f);
    setUploading(true);
    try {
      const [r] = await api.upload<{ url: string }[]>('/uploads/images?folder=chat', fd);
      send.mutate({ body: '', attachmentUrl: r.url });
    } catch (e) {
      toast(err(e), 'error');
    } finally {
      setUploading(false);
    }
  };
  const current = list.data?.find((c) => c.id === id);
  const cname = (c?: Conv) => (c?.kind === 'SUPPORT' && user?.role !== 'ADMIN' ? t('y.support.name') : c?.counterpart.name ?? '');

  return (
    <div>
      <PageHeader title={t('chat.title')} />
      <div className="grid h-[calc(100vh-14rem)] min-h-[480px] overflow-hidden rounded-2xl bg-white ring-1 ring-cream-200 md:grid-cols-[300px_1fr]">
        <aside className={cx('overflow-y-auto border-r border-cream-200', id && 'hidden md:block')}>
          {list.isLoading ? <div className="space-y-2 p-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : !list.data?.length ? <p className="p-6 text-center text-sm text-muted">{t('chat.empty')}</p> : list.data.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className={cx('flex items-center gap-3 border-b border-cream-100 px-4 py-3 hover:bg-cream-50', c.id === id && 'bg-brand-50')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-bold text-white">{c.kind === 'SUPPORT' && user?.role !== 'ADMIN' ? <Headset className="h-5 w-5" /> : c.counterpart.avatarUrl ? <img src={img(c.counterpart.avatarUrl)} alt="" className="h-full w-full object-cover" /> : c.counterpart.name.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2"><span className="truncate font-bold">{cname(c)}{c.kind === 'SUPPORT' && user?.role === 'ADMIN' && <Headset className="ml-1 inline h-3.5 w-3.5 text-brand" />}</span><span className="shrink-0 text-[11px] text-muted">{relative(c.lastMessageAt, lang)}</span></span>
                <span className="flex justify-between gap-2"><span className="truncate text-sm text-muted">{c.lastMessage?.body || '📎'}</span>{c.unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">{c.unread}</span>}</span>
              </span>
            </Link>
          ))}
        </aside>
        <section className={cx('flex min-h-0 flex-col', !id && 'hidden md:flex')}>
          {!id ? <div className="flex flex-1 items-center justify-center text-muted">{t('chat.select')}</div> : (
            <>
              <div className="flex items-center gap-3 border-b border-cream-200 px-4 py-3">
                <Link to="/messages" className="md:hidden" aria-label={t('common.back')}><ArrowLeft className="h-5 w-5" /></Link>
                <div className="min-w-0">
                  <p className="truncate font-bold">{cname(current)}</p>
                  {thread.data?.conversation.product && <Link to={`/product/${thread.data.conversation.product.slug}`} className="block truncate text-xs text-brand">{t('chat.product')}: {thread.data.conversation.product.name}</Link>}
                  {thread.data?.conversation.order && <p className="text-xs text-muted">{t('chat.order')}: #{thread.data.conversation.order.orderNumber}</p>}
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-cream-50 p-4">
                {thread.isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" /> : thread.data?.messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cx('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white text-ink')}>
                        {m.attachmentUrl && <a href={img(m.attachmentUrl)} target="_blank" rel="noreferrer"><img src={img(m.attachmentUrl)} alt="" className="mb-1 max-h-56 rounded-xl" /></a>}
                        {m.body && <TranslatableBody body={m.body} mine={mine} />}
                        <p className={cx('mt-0.5 text-right text-[10px]', mine ? 'text-white/70' : 'text-muted')}>{dateTime(m.createdAt, lang)}{mine && (m.readAt ? ' ✓✓' : ' ✓')}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              <form className="flex items-center gap-2 border-t border-cream-200 p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate({ body: text.trim() }); }}>
                <Button type="button" variant="ghost" size="icon" onClick={() => file.current?.click()} disabled={uploading} aria-label={t('chat.attach')}>{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}</Button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void attach(e.target.files?.[0])} />
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.placeholder')} maxLength={2000} aria-label={t('chat.placeholder')} />
                <Button type="submit" size="icon" loading={send.isPending} aria-label={t('chat.send')}>{!send.isPending && <Send className="h-4 w-4" />}</Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

