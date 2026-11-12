import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, BriefcaseBusiness, CheckCircle2, Handshake, KeyRound, Mail, MapPin, Navigation, Package, Phone, RefreshCw, Send, Trash2, Truck, UserPlus, UsersRound } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api } from '@/services/api';
import { useToast } from '@/store/toast';
import { useErrorText, useRegions } from '@/hooks';
import { cx, date, dateTime, money, num, phone } from '@/utils/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Skeleton, Tabs } from '@/components/ui';
import { PageHeader, StatusBadge } from '@/components/common';
import { SellerTrackingControl } from '@/components/LiveTracking';

type StaffRole = 'COURIER' | 'SALES';
interface Partnership { id: string; number: string; deliverySharePercent: string; status: string; startedAt: string; terms: { subject?: string; share?: string; regions?: string[]; couriers?: number; duties?: string; term?: string } }
interface StaffRow { id: string; email: string; role: StaffRole; status: 'invited' | 'active' | 'removed'; invitedAt: string; joinedAt: string | null; codeExpires: string | null; user: { id: string; fullName: string; phone: string | null } | null; activeDeliveries: number }

const useStaff = () => useQuery({ queryKey: ['staff', 'farm'], queryFn: () => api.get<{ partnership: Partnership | null; staff: StaffRow[] }>('/staff') });

/** Hamkorlik shartnomasi (platforma ↔ fermer) qisqacha */
export function PartnershipCard({ p }: { p: Partnership }) {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-brand-800 to-brand-700 p-4 text-white">
        <Handshake className="h-8 w-8 text-lime" />
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">{t('z.staff.partnership')}</p>
          <p className="font-extrabold">№ {p.number} · {t('z.staff.since', { d: date(p.startedAt, lang) })}</p>
        </div>
        <span className="rounded-2xl bg-white/15 px-4 py-2 text-center"><b className="block text-2xl">{Number(p.deliverySharePercent)}%</b><span className="text-[11px] text-white/80">{t('z.staff.shareLabel')}</span></span>
      </div>
      <div className="space-y-2 p-4 text-sm text-ink-soft">
        {p.terms.subject && <p>{p.terms.subject}</p>}
        {p.terms.share && <p className="font-semibold text-ink">{p.terms.share}</p>}
        {p.terms.regions?.length ? <p><MapPin className="mr-1 inline h-4 w-4 text-brand" />{p.terms.regions.map((r) => regionName(r)).join(', ')}</p> : null}
        {p.terms.term && <p className="text-xs text-muted">{p.terms.term}</p>}
      </div>
    </Card>
  );
}

/** Fermer: xodimlar (kuryer, sotuvchi) */
export function StaffPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useStaff();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('COURIER');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['staff'] });
  const invite = useMutation({
    mutationFn: () => api.post<{ id: string; delivered: boolean; devCode?: string }>('/staff/invite', { email: email.trim(), role }),
    onSuccess: (r) => {
      setOpen(false);
      setEmail('');
      setDemoCode(r.devCode ?? null);
      toast(r.delivered ? t('z.staff.sent') : t('z.staff.notDelivered'), r.delivered ? 'success' : 'error');
      refresh();
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const resend = useMutation({ mutationFn: (id: string) => api.post<{ delivered: boolean; devCode?: string }>(`/staff/${id}/resend`), onSuccess: (r) => { setDemoCode(r.devCode ?? null); toast(t('z.staff.sent')); }, onError: (e) => toast(err(e), 'error') });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/staff/${id}`), onSuccess: refresh, onError: (e) => toast(err(e), 'error') });
  if (q.isLoading || !q.data) return <Skeleton className="h-60" />;
  const { partnership, staff } = q.data;
  return (
    <div className="space-y-4">
      <PageHeader title={t('z.nav.staff')} subtitle={t('z.staff.subtitle')} actions={partnership && <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" />{t('z.staff.invite')}</Button>} />
      {!partnership ? (
        <Card className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sun-100 text-amber-700"><Handshake className="h-7 w-7" /></span>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold">{t('z.staff.needTitle')}</h2>
              <p className="mt-1 text-sm text-ink-soft">{t('z.staff.needText')}</p>
              <ul className="mt-3 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
                {(['b1', 'b2', 'b3', 'b4'] as const).map((k) => <li key={k} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{t(`z.staff.${k}` as TKey)}</li>)}
              </ul>
              <Link to="/seller/applications/new/partnership"><Button className="mt-4"><Send className="h-4 w-4" />{t('z.staff.apply')}</Button></Link>
            </div>
          </div>
        </Card>
      ) : (
        <PartnershipCard p={partnership} />
      )}
      {demoCode && <p className="rounded-xl bg-sun-100 px-4 py-2 text-sm text-amber-800">{t('z.staff.demoCode')}: <b className="font-mono text-base tracking-widest">{demoCode}</b></p>}
      {partnership && (
        !staff.length ? <Card className="p-8"><Empty icon={<UsersRound className="h-8 w-8" />} title={t('z.staff.empty')} hint={t('z.staff.emptyHint')} /></Card> : (
          <div className="grid gap-3 md:grid-cols-2">
            {staff.map((s) => (
              <Card key={s.id} className="flex items-start gap-3 p-4">
                <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.role === 'COURIER' ? 'bg-sky-50 text-sky-700' : 'bg-lime-50 text-lime-700')}>{s.role === 'COURIER' ? <Bike className="h-5 w-5" /> : <Package className="h-5 w-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.user?.fullName ?? s.email}</p>
                  <p className="truncate text-xs text-muted">{s.email}{s.user?.phone ? ` · ${phone(s.user.phone)}` : ''}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{t(`z.staff.r_${s.role}` as TKey)}</Badge>
                    <Badge tone={s.status === 'active' ? 'green' : 'yellow'}>{t(`z.staff.s_${s.status}` as TKey)}</Badge>
                    {s.role === 'COURIER' && s.status === 'active' && <span className="text-xs text-muted">{t('z.staff.activeDeliveries', { n: s.activeDeliveries })}</span>}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{s.joinedAt ? t('z.staff.joined', { d: date(s.joinedAt, lang) }) : t('z.staff.invited', { d: date(s.invitedAt, lang) })}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {s.status === 'invited' && <Button size="icon" variant="ghost" title={t('z.staff.resend')} loading={resend.isPending} onClick={() => resend.mutate(s.id)}><RefreshCw className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" title={t('common.delete')} onClick={() => confirm(t('z.staff.removeQ')) && remove.mutate(s.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
      <Card className="bg-cream-50 p-4 text-sm text-ink-soft">
        <p className="mb-1 font-bold text-ink">{t('z.staff.howTitle')}</p>
        <ol className="list-decimal space-y-1 pl-5">{(['h1', 'h2', 'h3', 'h4'] as const).map((k) => <li key={k}>{t(`z.staff.${k}` as TKey)}</li>)}</ol>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={t('z.staff.invite')} footer={<Button block loading={invite.isPending} disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => invite.mutate()}><Mail className="h-4 w-4" />{t('z.staff.sendCode')}</Button>}>
        <div className="space-y-3">
          <Field label="Email" hint={t('z.staff.emailHint')}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kuryer@example.uz" /></Field>
          <div className="grid grid-cols-2 gap-2">
            {(['COURIER', 'SALES'] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} className={cx('flex flex-col items-start gap-1 rounded-xl p-3 text-left ring-2', role === r ? 'bg-brand-50 ring-brand' : 'bg-white ring-cream-200')}>
                {r === 'COURIER' ? <Bike className="h-5 w-5 text-brand" /> : <Package className="h-5 w-5 text-brand" />}
                <b className="text-sm">{t(`z.staff.r_${r}` as TKey)}</b>
                <span className="text-xs text-muted">{t(`z.staff.rd_${r}` as TKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Fermer buyurtma sahifasida: kuryer biriktirish */
export function AssignCourier({ sellerOrderId, status, current }: { sellerOrderId: string; status: string; current: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const q = useStaff();
  const couriers = (q.data?.staff ?? []).filter((s) => s.role === 'COURIER' && s.status === 'active');
  const [sel, setSel] = useState('');
  const m = useMutation({
    mutationFn: () => api.post<{ courierName?: string }>(`/staff/assign/${sellerOrderId}`, { staffId: sel || null }),
    onSuccess: (r) => { toast(r.courierName ? t('z.staff.assigned', { name: r.courierName }) : t('common.saved')); void qc.invalidateQueries({ queryKey: ['seller'] }); void qc.invalidateQueries({ queryKey: ['staff'] }); },
    onError: (e) => toast(err(e), 'error'),
  });
  if (!q.data?.partnership || !couriers.length || !['confirmed', 'preparing', 'ready_for_delivery', 'shipped'].includes(status)) return null;
  return (
    <Card className="p-4">
      <p className="mb-2 flex items-center gap-2 font-bold"><Bike className="h-4 w-4 text-brand" />{t('z.staff.assign')}</p>
      {current && <p className="mb-2 text-sm text-ink-soft">{t('account.courier')}: <b>{current}</b></p>}
      <div className="flex gap-2">
        <Select value={sel} onChange={(e) => setSel(e.target.value)} className="flex-1">
          <option value="">{t('z.staff.choose')}</option>
          {couriers.map((c) => <option key={c.id} value={c.id}>{c.user?.fullName ?? c.email} · {t('z.staff.activeDeliveries', { n: c.activeDeliveries })}</option>)}
        </Select>
        <Button loading={m.isPending} disabled={!sel} onClick={() => m.mutate()}>{t('common.save')}</Button>
      </div>
    </Card>
  );
}

// ───────── Xodim kabineti: «Ish joyi» ─────────
interface Invite { id: string; role: StaffRole; status: 'invited' | 'active'; expired: boolean; seller: { id: string; farmName: string; region: string; district: string } }
interface Delivery {
  id: string;
  number: string;
  status: string;
  total: string;
  items: { productName: string; quantity: string; unit: string }[];
  delivery: { status: string; weightKg: string | null; trackingActive: boolean; scheduledDate: string | null; slot: string | null; deliveredAt: string | null } | null;
  seller: { farmName: string };
  order: { id: string; recipientName: string; contactPhone: string; region: string; district: string; addressLine: string; deliveryNotes: string | null; paymentMethod: string; paymentStatus: string; total: string };
}
interface SalesOrder { id: string; number: string; status: string; total: string; items: { productName: string; quantity: string; unit: string; lineTotal: string }[]; seller: { farmName: string }; order: { recipientName: string; district: string; deliveryDate: string | null; deliverySlot: string | null; paymentMethod: string } }

function InviteCard({ inv }: { inv: Invite }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const m = useMutation({ mutationFn: () => api.post('/staff/accept', { inviteId: inv.id, code }), onSuccess: () => { toast(t('z.work.joined', { farm: inv.seller.farmName })); void qc.invalidateQueries({ queryKey: ['staff'] }); }, onError: (e) => toast(err(e), 'error') });
  return (
    <Card className="border-2 border-sun p-4">
      <p className="font-extrabold">{t('z.work.inviteTitle', { farm: inv.seller.farmName, role: t(`z.staff.r_${inv.role}` as TKey).toLowerCase() })}</p>
      <p className="mt-1 text-sm text-ink-soft">{inv.expired ? t('z.work.expired') : t('z.work.inviteText')}</p>
      {!inv.expired && (
        <div className="mt-3 flex gap-2">
          <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" className="w-36 text-center font-mono text-lg tracking-[0.4em]" />
          <Button loading={m.isPending} disabled={code.length !== 6} onClick={() => m.mutate()}><KeyRound className="h-4 w-4" />{t('z.work.accept')}</Button>
        </div>
      )}
    </Card>
  );
}

function DeliveryCard({ d }: { d: Delivery }) {
  const { t, lang } = useI18n();
  const { regionName } = useRegions();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const act = useMutation({ mutationFn: (a: 'ship' | 'delivered') => api.post(`/staff/work/deliveries/${d.id}/${a}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff', 'work'] }), onError: (e) => toast(err(e), 'error') });
  const address = [regionName(d.order.region), d.order.district, d.order.addressLine].filter(Boolean).join(', ');
  const collect = d.order.paymentMethod === 'cash' && d.order.paymentStatus !== 'paid';
  return (
    <Card className={cx('p-4', d.status === 'delivered' && 'opacity-70')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-muted">№ {d.number} · {d.seller.farmName}</p>
          <p className="text-lg font-extrabold text-ink">{d.order.recipientName}</p>
        </div>
        <StatusBadge status={d.status} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{address}</p>
      {d.order.deliveryNotes && <p className="mt-1 rounded-lg bg-cream-100 px-2 py-1 text-xs">{d.order.deliveryNotes}</p>}
      {d.delivery?.scheduledDate && <p className="mt-1 text-xs text-muted">{date(d.delivery.scheduledDate, lang)} · {d.delivery.slot}</p>}
      <ul className="mt-2 text-sm text-ink-soft">{d.items.map((i, k) => <li key={k}>• {i.productName} — {num(i.quantity)} {t(`units.${i.unit}` as TKey)}</li>)}</ul>
      {collect && <p className="mt-2 rounded-xl bg-sun-100 px-3 py-2 text-sm font-bold text-amber-800">{t('z.work.collect', { amount: money(d.total, lang) })}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`tel:${d.order.contactPhone}`}><Button size="sm" variant="outline"><Phone className="h-4 w-4" />{phone(d.order.contactPhone)}</Button></a>
        <a href={`https://yandex.uz/maps/?mode=routes&rtt=auto&rtext=~${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Navigation className="h-4 w-4" />{t('y.map.route')}</Button></a>
        {d.status === 'ready_for_delivery' && <Button size="sm" loading={act.isPending} onClick={() => act.mutate('ship')}><Truck className="h-4 w-4" />{t('z.work.ship')}</Button>}
        {d.status === 'shipped' && <Button size="sm" loading={act.isPending} onClick={() => confirm(t('z.work.deliveredQ')) && act.mutate('delivered')}><CheckCircle2 className="h-4 w-4" />{t('z.work.delivered')}</Button>}
      </div>
      {['ready_for_delivery', 'shipped'].includes(d.status) && <div className="mt-3"><SellerTrackingControl sellerOrderId={d.id} status={d.status} weightKg={d.delivery?.weightKg ?? undefined} /></div>}
      {d.delivery?.deliveredAt && <p className="mt-2 text-xs text-brand">✓ {dateTime(d.delivery.deliveredAt, lang)}</p>}
    </Card>
  );
}

function SalesCard({ o }: { o: SalesOrder }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const next: Record<string, string> = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready_for_delivery' };
  const m = useMutation({ mutationFn: () => api.post(`/staff/work/orders/${o.id}/status`, { status: next[o.status] }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff', 'work'] }), onError: (e) => toast(err(e), 'error') });
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-mono text-xs text-muted">№ {o.number} · {o.seller.farmName}</p><p className="font-extrabold">{o.order.recipientName}</p></div>
        <StatusBadge status={o.status} />
      </div>
      <ul className="mt-2 text-sm text-ink-soft">{o.items.map((i, k) => <li key={k}>• {i.productName} — {num(i.quantity)} {t(`units.${i.unit}` as TKey)}</li>)}</ul>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted">{o.order.deliveryDate ? `${date(o.order.deliveryDate, lang)} · ${o.order.deliverySlot ?? ''}` : ''}</span>
        <b className="text-brand">{money(o.total, lang)}</b>
      </div>
      {next[o.status] && <Button size="sm" className="mt-3" loading={m.isPending} onClick={() => m.mutate()}>{t(`status.${next[o.status]}` as TKey)} →</Button>}
    </Card>
  );
}

export function WorkPage() {
  const { t } = useI18n();
  const me = useQuery({ queryKey: ['staff', 'me'], queryFn: () => api.get<Invite[]>('/staff/me') });
  const active = (me.data ?? []).filter((x) => x.status === 'active');
  const invites = (me.data ?? []).filter((x) => x.status === 'invited');
  const isCourier = active.some((x) => x.role === 'COURIER');
  const isSales = active.some((x) => x.role === 'SALES');
  const [tab, setTab] = useState<'deliveries' | 'orders'>(isCourier ? 'deliveries' : 'orders');
  const dels = useQuery({ queryKey: ['staff', 'work', 'deliveries'], queryFn: () => api.get<Delivery[]>('/staff/work/deliveries'), enabled: isCourier, refetchInterval: 30_000 });
  const ords = useQuery({ queryKey: ['staff', 'work', 'orders'], queryFn: () => api.get<SalesOrder[]>('/staff/work/orders'), enabled: isSales, refetchInterval: 30_000 });
  const cur = isCourier && isSales ? tab : isCourier ? 'deliveries' : 'orders';
  if (me.isLoading) return <Skeleton className="h-60" />;
  return (
    <div className="space-y-4">
      <PageHeader title={t('z.nav.work')} subtitle={active.map((a) => `${a.seller.farmName} · ${t(`z.staff.r_${a.role}` as TKey)}`).join(' / ') || t('z.work.subtitle')} />
      {invites.map((i) => <InviteCard key={i.id} inv={i} />)}
      {!active.length && !invites.length && <Card className="p-8"><Empty icon={<BriefcaseBusiness className="h-8 w-8" />} title={t('z.work.none')} hint={t('z.work.noneHint')} /></Card>}
      {isCourier && isSales && <Tabs value={tab} onChange={setTab} items={[{ value: 'deliveries', label: t('z.work.deliveries') }, { value: 'orders', label: t('z.work.orders') }]} />}
      {active.length > 0 && cur === 'deliveries' && (
        dels.isLoading ? <Skeleton className="h-40" /> : !dels.data?.length ? <Card className="p-8"><Empty icon={<Truck className="h-8 w-8" />} title={t('z.work.noDeliveries')} /></Card> : (
          <div className="grid gap-3 lg:grid-cols-2">{dels.data.map((d) => <DeliveryCard key={d.id} d={d} />)}</div>
        )
      )}
      {active.length > 0 && cur === 'orders' && isSales && (
        ords.isLoading ? <Skeleton className="h-40" /> : !ords.data?.length ? <Card className="p-8"><Empty icon={<Package className="h-8 w-8" />} title={t('z.work.noOrders')} /></Card> : (
          <div className="grid gap-3 lg:grid-cols-2">{ords.data.map((o) => <SalesCard key={o.id} o={o} />)}</div>
        )
      )}
    </div>
  );
}
