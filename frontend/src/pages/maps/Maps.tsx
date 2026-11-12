import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, MapPin, Navigation, Pencil, Phone, Plus, Search, Star, Store, Tractor, Trash2, Warehouse, Package } from 'lucide-react';
import { useI18n, type TKey } from '@/i18n';
import { api, qs } from '@/services/api';
import { useDebounce, useErrorText, useRegions } from '@/hooks';
import { useToast } from '@/store/toast';
import { cx, phone as fmtPhone } from '@/utils/format';
import { Badge, Button, Card, Checkbox, Empty, Field, Input, Modal, Select, Skeleton } from '@/components/ui';
import { PageHeader, RegionDistrictSelect } from '@/components/common';
import { GeoMap, type LatLng, type MapMarker } from '@/components/GeoMap';

export type PointType = 'FARM' | 'SALES_CENTER' | 'WAREHOUSE' | 'PICKUP';
export interface SalesPoint {
  id: string;
  type: PointType;
  name: string;
  region: string;
  district: string | null;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  hours: string | null;
  isActive: boolean;
  seller?: { id: string; farmName: string; slug: string; logoUrl: string | null; ratingAvg: string; ratingCount: number; verificationStatus: string; _count: { products: number } };
}

export const POINT_META: Record<PointType, { color: string; icon: typeof Tractor }> = {
  FARM: { color: '#1F6B45', icon: Tractor },
  SALES_CENTER: { color: '#E2711D', icon: Store },
  WAREHOUSE: { color: '#1E3A8A', icon: Warehouse },
  PICKUP: { color: '#7C3AED', icon: Package },
};
const TYPES: PointType[] = ['FARM', 'SALES_CENTER', 'WAREHOUSE', 'PICKUP'];
const directions = (p: { lat: number; lng: number }) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

/** Ommaviy: sotuv markazlari xaritasi */
export function MapPage() {
  const { t } = useI18n();
  const { regionName } = useRegions();
  const [type, setType] = useState<PointType | ''>('');
  const [search, setSearch] = useState('');
  const dq = useDebounce(search);
  const [sel, setSel] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['public', 'map', type, dq], queryFn: () => api.get<SalesPoint[]>(`/maps/points${qs({ type, q: dq })}`) });
  const points = q.data ?? [];
  const markers: MapMarker[] = useMemo(
    () =>
      points.map((p) => {
        const M = POINT_META[p.type];
        return { id: p.id, lat: p.lat, lng: p.lng, color: M.color, label: p.name, icon: <M.icon className="h-4 w-4" />, active: sel === p.id, onClick: () => setSel(p.id) };
      }),
    [points, sel],
  );
  const selected = points.find((p) => p.id === sel);
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader title={t('y.map.title')} subtitle={t('y.map.subtitle')} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('y.map.search')} left={<Search className="h-4 w-4" />} />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <button type="button" onClick={() => setType('')} className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-bold ring-1', !type ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-cream-200')}>{t('y.map.all')}</button>
          {TYPES.map((k) => {
            const M = POINT_META[k];
            return (
              <button key={k} type="button" onClick={() => setType(k)} className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ring-1', type === k ? 'text-white' : 'bg-white text-ink-soft ring-cream-200')} style={type === k ? { background: M.color } : undefined}>
                <M.icon className="h-4 w-4" />{t(`y.map.${k}` as TKey)}
              </button>
            );
          })}
        </div>
        <span className="text-sm font-semibold text-muted lg:ml-auto">{t('y.map.count', { n: points.length })}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="relative">
          <GeoMap markers={markers} fit={!sel} center={selected ? { lat: selected.lat, lng: selected.lng } : undefined} zoom={selected ? 13 : 6} className="h-[60vh] min-h-[380px]" />
          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-30 lg:hidden"><PointCard p={selected} regionName={regionName} /></div>
          )}
        </div>
        <div className="space-y-3 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
          {q.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          ) : !points.length ? (
            <Empty title={t('y.map.empty')} icon={<MapPin className="h-8 w-8" />} />
          ) : (
            points.map((p) => (
              <button key={p.id} type="button" onClick={() => setSel(p.id)} className={cx('block w-full text-left', sel === p.id && 'rounded-2xl ring-2 ring-brand')}>
                <PointCard p={p} regionName={regionName} compact={sel !== p.id} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PointCard({ p, regionName, compact }: { p: SalesPoint; regionName: (c: string) => string; compact?: boolean }) {
  const { t } = useI18n();
  const M = POINT_META[p.type];
  return (
    <Card className="p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: M.color }}><M.icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: M.color }}>{t(`y.map.${p.type}` as TKey)}</p>
          <p className="truncate font-extrabold text-ink">{p.name}</p>
          {p.seller && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <BadgeCheck className="h-3.5 w-3.5 text-brand" />{p.seller.farmName}
              <Star className="ml-1 h-3 w-3 fill-sun text-sun" />{Number(p.seller.ratingAvg).toFixed(1)}
            </p>
          )}
        </div>
      </div>
      {!compact && (
        <div className="mt-3 space-y-1.5 text-sm text-ink-soft">
          <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />{regionName(p.region)}{p.district ? `, ${p.district}` : ''} — {p.address}</p>
          {p.hours && <p className="flex gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />{t('y.map.hours')}: {p.hours}</p>}
          {p.phone && <a href={`tel:${p.phone}`} className="flex gap-2 text-brand"><Phone className="mt-0.5 h-4 w-4 shrink-0" />{fmtPhone(p.phone)}</a>}
          <div className="flex flex-wrap gap-2 pt-2">
            <a href={directions(p)} target="_blank" rel="noreferrer" data-external className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white"><Navigation className="h-3.5 w-3.5" />{t('y.map.route')}</a>
            {p.seller && <Link to={`/farmers/${p.seller.slug}`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-2 text-xs font-bold text-brand">{t('y.map.openFarm')} · {t('y.map.products', { n: p.seller._count.products })}</Link>}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Fermer: o'z sotuv nuqtalari */
export function SalesPointsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const { regionName } = useRegions();
  const q = useQuery({ queryKey: ['my-points'], queryFn: () => api.get<SalesPoint[]>('/maps/my-points') });
  const [edit, setEdit] = useState<Partial<SalesPoint> | null>(null);
  const del = useMutation({ mutationFn: (id: string) => api.del(`/maps/my-points/${id}`), onSuccess: () => { toast(t('y.points.deleted')); void qc.invalidateQueries({ queryKey: ['my-points'] }); }, onError: (e) => toast(err(e), 'error') });
  const points = q.data ?? [];
  return (
    <div>
      <PageHeader title={t('y.points.title')} subtitle={t('y.points.subtitle')} actions={<Button onClick={() => setEdit({ type: 'SALES_CENTER', isActive: true })}><Plus className="h-4 w-4" />{t('y.points.add')}</Button>} />
      <GeoMap
        markers={points.map((p) => {
          const M = POINT_META[p.type];
          return { id: p.id, lat: p.lat, lng: p.lng, color: M.color, label: p.name, icon: <M.icon className="h-4 w-4" />, onClick: () => setEdit(p) };
        })}
        fit
        className="h-80"
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {q.isLoading ? <Skeleton className="h-24" /> : !points.length ? <Card className="p-6 md:col-span-2"><Empty title={t('y.points.empty')} icon={<MapPin className="h-8 w-8" />} /></Card> : points.map((p) => {
          const M = POINT_META[p.type];
          return (
            <Card key={p.id} className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: M.color }}><M.icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{p.name} {!p.isActive && <Badge tone="gray">off</Badge>}</p>
                <p className="text-xs text-muted">{t(`y.map.${p.type}` as TKey)} · {regionName(p.region)}{p.district ? `, ${p.district}` : ''}</p>
                <p className="mt-1 text-sm text-ink-soft">{p.address}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEdit(p)} className="rounded-lg p-2 hover:bg-cream-100" aria-label={t('common.edit')}><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => confirm(`${t('common.delete')}: ${p.name}?`) && del.mutate(p.id)} className="rounded-lg p-2 text-danger hover:bg-red-50" aria-label={t('common.delete')}><Trash2 className="h-4 w-4" /></button>
              </div>
            </Card>
          );
        })}
      </div>
      {edit && <PointForm initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PointForm({ initial, onClose }: { initial: Partial<SalesPoint>; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const err = useErrorText();
  const qc = useQueryClient();
  const [v, setV] = useState<Partial<SalesPoint>>(initial);
  const pick: LatLng | null = v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null;
  const save = useMutation({
    mutationFn: () => {
      const body = { type: v.type, name: v.name, region: v.region, district: v.district || null, address: v.address, lat: v.lat, lng: v.lng, phone: v.phone || null, hours: v.hours || null, isActive: v.isActive ?? true };
      return v.id ? api.put(`/maps/my-points/${v.id}`, body) : api.post('/maps/my-points', body);
    },
    onSuccess: () => {
      toast(t('y.points.saved'));
      void qc.invalidateQueries({ queryKey: ['my-points'] });
      onClose();
    },
    onError: (e) => toast(err(e), 'error'),
  });
  return (
    <Modal open onClose={onClose} title={v.id ? t('y.points.edit') : t('y.points.add')} wide footer={<Button block loading={save.isPending} disabled={!pick || !v.name || !v.region || !v.address} onClick={() => save.mutate()}>{t('common.save')}</Button>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Field label={t('y.points.type')}>
            <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as PointType })}>
              {TYPES.map((k) => <option key={k} value={k}>{t(`y.map.${k}` as TKey)}</option>)}
            </Select>
          </Field>
          <Field label={t('y.points.name')}><Input value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <RegionDistrictSelect region={v.region ?? ''} district={v.district ?? null} onChange={(r, d) => setV({ ...v, region: r, district: d })} />
          <Field label={t('y.points.address')}><Input value={v.address ?? ''} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('y.points.phone')}><Input value={v.phone ?? ''} onChange={(e) => setV({ ...v, phone: e.target.value })} inputMode="tel" /></Field>
            <Field label={t('y.points.hours')}><Input value={v.hours ?? ''} onChange={(e) => setV({ ...v, hours: e.target.value })} placeholder={t('y.points.hoursPh')} /></Field>
          </div>
          <Checkbox checked={v.isActive ?? true} onChange={(e) => setV({ ...v, isActive: e.target.checked })} label={t('y.points.active')} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">{t('y.points.pickHint')}</p>
          <GeoMap pick={pick} onPick={(p) => setV({ ...v, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })} onLocate={(p) => setV({ ...v, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })} center={pick ?? undefined} zoom={pick ? 14 : 6} className="h-72" />
          <p className="text-xs font-mono text-muted">{pick ? `${pick.lat}, ${pick.lng}` : t('y.points.pickRequired')}</p>
        </div>
      </div>
    </Modal>
  );
}

/** Fermer xo'jaligi sahifasi: shu xo'jalikning sotuv markazlari va olib ketish nuqtalari xaritada */
export function FarmPointsSection({ sellerId }: { sellerId: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['public', 'points', 'seller', sellerId], queryFn: () => api.get<SalesPoint[]>(`/maps/points?sellerId=${sellerId}`) });
  const [sel, setSel] = useState<string | null>(null);
  const pts = q.data ?? [];
  if (!pts.length) return null;
  const cur = pts.find((p) => p.id === sel) ?? null;
  return (
    <section className="mt-10">
      <h2 className="mb-1 text-xl font-extrabold text-ink">{t('z.farm.points')}</h2>
      <p className="mb-4 text-sm text-ink-soft">{t('z.farm.pointsText')}</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <GeoMap className="h-[340px] rounded-2xl" fit markers={pts.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: POINT_META[p.type].color, label: p.name, active: cur?.id === p.id, onClick: () => setSel(p.id) }))} />
        <ul className="max-h-[340px] space-y-2 overflow-y-auto">
          {pts.map((p) => {
            const M = POINT_META[p.type];
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setSel(p.id)} className={cx('flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left ring-1', cur?.id === p.id ? 'ring-brand' : 'ring-cream-200')}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: M.color }}><M.icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{p.name}</span>
                    <span className="block text-xs text-muted">{t(`y.map.${p.type}` as TKey)} · {p.address}</span>
                    {p.hours && <span className="block text-xs text-muted">{p.hours}</span>}
                    <a href={directions(p)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-block text-xs font-bold text-brand">{t('y.map.route')} →</a>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
