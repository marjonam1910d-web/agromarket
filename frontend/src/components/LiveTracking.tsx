import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigation, Phone, Radio, Square, Tractor, Truck } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api, ApiError } from '@/services/api';
import { useToast } from '@/store/toast';
import { cx, dateTime, num, phone as fmtPhone } from '@/utils/format';
import { Button, Card } from '@/components/ui';
import { GeoMap, type MapMarker } from '@/components/GeoMap';
import { useAppLock } from '@/security/AppLock';

export interface Tracking {
  sellerOrderId: string;
  number: string;
  status: string;
  deliveryStatus: string;
  weightKg: string;
  large: boolean;
  courierName: string | null;
  courierPhone: string | null;
  trackingActive: boolean;
  courier: { lat: number; lng: number; heading: number | null; updatedAt: string } | null;
  origin: { lat: number; lng: number } | null;
  farm: string;
  points: { id: string; name: string; type: string; lat: number; lng: number }[];
}

/** WebSocket'dan kelgan kuryer joylashuvini tinglash (useRealtime → window hodisasi) */
function useCourierEvents(sellerOrderId: string, onPos: (p: { lat: number; lng: number; active: boolean; at?: string; heading?: number | null }) => void) {
  const cb = useRef(onPos);
  cb.current = onPos;
  useEffect(() => {
    const f = (e: Event) => {
      const d = (e as CustomEvent).detail as { sellerOrderId: string; lat: number; lng: number; active: boolean; at?: string; heading?: number | null };
      if (d.sellerOrderId === sellerOrderId) cb.current(d);
    };
    window.addEventListener('am:courier', f);
    return () => window.removeEventListener('am:courier', f);
  }, [sellerOrderId]);
}

/** Xaridor: buyurtma sahifasida jonli xarita */
export function BuyerTracking({ sellerOrderId }: { sellerOrderId: string }) {
  const { t, lang } = useI18n();
  const q = useQuery({ queryKey: ['tracking', sellerOrderId], queryFn: () => api.get<Tracking>(`/maps/tracking/${sellerOrderId}`), refetchInterval: (x) => (x.state.data?.trackingActive ? 30_000 : false) });
  const [live, setLive] = useState<{ lat: number; lng: number; at?: string; active: boolean } | null>(null);
  useCourierEvents(sellerOrderId, (p) => setLive(p));
  const d = q.data;
  if (!d) return null;
  const active = live ? live.active : d.trackingActive;
  const courier = live?.lat != null ? live : d.courier;
  if (!active && !d.courier && !d.points.length) return null;
  const markers: MapMarker[] = [
    ...d.points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: '#8BC34A', label: p.name, icon: <Tractor className="h-4 w-4" /> })),
    ...(courier && active ? [{ id: 'courier', lat: courier.lat, lng: courier.lng, color: '#E2711D', label: t('y.track.courierPos'), icon: <Truck className="h-4 w-4" />, pulse: true, active: true }] : []),
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="flex items-center gap-2 font-extrabold text-ink"><Navigation className="h-4 w-4 text-brand" />{t('y.track.title')}</p>
        {active ? <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-black text-danger"><span className="h-2 w-2 animate-pulse rounded-full bg-danger" />{t('y.track.live')}</span> : null}
      </div>
      <GeoMap markers={markers} line={active && courier && d.origin ? [d.origin, courier] : undefined} fit className="h-72 rounded-none ring-0" zoom={7} />
      <div className="space-y-1 px-4 py-3 text-sm">
        {active ? (
          <>
            {d.courierName && <p className="font-bold text-ink">{t('y.track.courier')}: {d.courierName} {d.courierPhone && <a href={`tel:${d.courierPhone}`} className="ml-1 inline-flex items-center gap-1 text-brand underline"><Phone className="h-3.5 w-3.5" />{fmtPhone(d.courierPhone)}</a>}</p>}
            {courier && 'at' in courier && courier.at && <p className="text-xs text-muted">{t('y.track.lastUpdate')}: {dateTime(courier.at, lang)}</p>}
            {d.courier?.updatedAt && !live && <p className="text-xs text-muted">{t('y.track.lastUpdate')}: {dateTime(d.courier.updatedAt, lang)}</p>}
          </>
        ) : (
          <p className="text-muted">{d.courier ? t('y.track.ended') : t('y.track.waiting')}</p>
        )}
      </div>
    </Card>
  );
}

/** Fermer / kuryer: telefondan GPS'ni yuborish */
export function SellerTrackingControl({ sellerOrderId, status, weightKg }: { sellerOrderId: string; status: string; weightKg?: string | number }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const lock = useAppLock();
  const q = useQuery({ queryKey: ['tracking', sellerOrderId], queryFn: () => api.get<Tracking>(`/maps/tracking/${sellerOrderId}`) });
  const watch = useRef<number | null>(null);
  const last = useRef(0);
  const [sharing, setSharing] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  const stopWatch = () => {
    if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
  };
  useEffect(() => () => stopWatch(), []);

  const send = async (c: GeolocationCoordinates, first: boolean) => {
    const body = { lat: c.latitude, lng: c.longitude, accuracy: Math.min(c.accuracy ?? 0, 5000), heading: c.heading ?? null };
    setPos({ lat: c.latitude, lng: c.longitude });
    try {
      await api.post(`/maps/tracking/${sellerOrderId}/${first ? 'start' : 'location'}`, body);
      last.current = Date.now();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('common.error'), 'error');
      stopWatch();
    }
  };

  const start = () => {
    if (!navigator.geolocation) return toast(t('y.track.denied'), 'error');
    lock.suppressOnce(); // GPS ruxsat oynasi ilovani qulflamasin
    let first = true;
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        if (first) {
          first = false;
          setSharing(true);
          void send(p.coords, true).then(() => qc.invalidateQueries({ queryKey: ['tracking', sellerOrderId] }));
        } else if (Date.now() - last.current > 10_000) void send(p.coords, false);
      },
      () => {
        toast(t('y.track.denied'), 'error');
        stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
  };
  const stop = async () => {
    stopWatch();
    await api.post(`/maps/tracking/${sellerOrderId}/stop`).catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['tracking', sellerOrderId] });
  };

  if (!['ready_for_delivery', 'shipped'].includes(status)) {
    return q.data?.large ? <p className="rounded-xl bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800">{t('y.track.large', { kg: num(weightKg ?? q.data.weightKg, 0) })}</p> : null;
  }
  const remoteActive = q.data?.trackingActive;
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 font-extrabold"><Radio className={cx('h-4 w-4', sharing ? 'animate-pulse text-danger' : 'text-brand')} />{t('y.track.title')}</p>
      {q.data?.large && <p className="rounded-xl bg-sun-100 px-3 py-2 text-xs font-semibold text-amber-800">{t('y.track.large', { kg: num(q.data.weightKg, 0) })}</p>}
      {sharing ? (
        <>
          <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">{t('y.track.sharing')}</p>
          <p className="text-xs text-muted">{t('y.track.keepOpen')}</p>
          {pos && <GeoMap markers={[{ id: 'me', lat: pos.lat, lng: pos.lng, color: '#E2711D', icon: <Truck className="h-4 w-4" />, pulse: true }]} center={pos} zoom={15} className="h-56" />}
          <Button variant="outline" onClick={() => void stop()}><Square className="h-4 w-4" />{t('y.track.stop')}</Button>
        </>
      ) : (
        <Button onClick={start}><Navigation className="h-4 w-4" />{t('y.track.start')}</Button>
      )}
      {!sharing && remoteActive && <Button variant="ghost" size="sm" onClick={() => void stop()}>{t('y.track.stop')}</Button>}
    </Card>
  );
}
