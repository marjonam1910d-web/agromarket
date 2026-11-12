import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import { cx } from '@/utils/format';

/**
 * Qaramliksiz yengil xarita (OpenStreetMap kartalari): surish, g'ildirak / tugma / ikki barmoq bilan kattalashtirish,
 * markerlar, chiziq (masalan ferma → kuryer), xaritani bosib nuqta tanlash.
 * Xarita ma'lumotlari © OpenStreetMap hissadorlari (ODbL).
 */
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  icon?: ReactNode;
  pulse?: boolean;
  active?: boolean;
  onClick?: () => void;
}
export interface LatLng {
  lat: number;
  lng: number;
}

const TILE = 256;
const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat));
const project = (lat: number, lng: number, z: number) => {
  const s = TILE * 2 ** z;
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
};
const unproject = (x: number, y: number, z: number): LatLng => {
  const s = TILE * 2 ** z;
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng };
};

export const UZ_CENTER: LatLng = { lat: 41.2, lng: 64.5 };

export function GeoMap({
  center,
  zoom: zoom0 = 6,
  markers = [],
  line,
  onPick,
  pick,
  fit,
  className,
  minZoom = 4,
  maxZoom = 18,
  onLocate,
}: {
  center?: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  line?: LatLng[];
  onPick?: (p: LatLng) => void;
  pick?: LatLng | null;
  /** markerlarni ko'rinadigan qilib avtomatik moslash */
  fit?: boolean;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
  onLocate?: (p: LatLng) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [view, setView] = useState<{ c: LatLng; z: number }>({ c: center ?? UZ_CENTER, z: zoom0 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Tashqi markaz o'zgarsa (masalan kuryer harakati)
  useEffect(() => {
    if (center && !fit) setView((v) => ({ ...v, c: center }));
  }, [center?.lat, center?.lng, fit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Markerlarni sig'dirish
  const fitKey = fit ? markers.map((m) => `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`).join('|') + (line?.length ?? 0) : '';
  useEffect(() => {
    if (!fit) return;
    const pts = [...markers, ...(line ?? [])];
    if (!pts.length || size.w < 50) return;
    if (pts.length === 1) return setView({ c: { lat: pts[0].lat, lng: pts[0].lng }, z: Math.max(zoom0, 12) });
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const c = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
    let z = maxZoom;
    for (; z > minZoom; z--) {
      const a = project(Math.max(...lats), Math.min(...lngs), z);
      const b = project(Math.min(...lats), Math.max(...lngs), z);
      if (b.x - a.x < size.w - 80 && b.y - a.y < size.h - 80) break;
    }
    setView({ c, z: Math.min(z, 15) });
  }, [fitKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const cpx = project(view.c.lat, view.c.lng, view.z);
  const left = cpx.x - size.w / 2;
  const top = cpx.y - size.h / 2;
  const n = 2 ** view.z;

  const tiles = useMemo(() => {
    const out: { key: string; src: string; x: number; y: number }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        out.push({ key: `${view.z}/${tx}/${ty}`, src: TILE_URL(view.z, wx, ty), x: tx * TILE - left, y: ty * TILE - top });
      }
    }
    return out;
  }, [left, top, size.w, size.h, view.z, n]);

  const toScreen = useCallback((lat: number, lng: number) => {
    const p = project(lat, lng, view.z);
    return { x: p.x - left, y: p.y - top };
  }, [view.z, left, top]);

  const zoomAt = (dz: number, sx = size.w / 2, sy = size.h / 2) => {
    setView((v) => {
      const z = Math.max(minZoom, Math.min(maxZoom, v.z + dz));
      if (z === v.z) return v;
      const before = project(v.c.lat, v.c.lng, v.z);
      const anchorWorld = { x: before.x - size.w / 2 + sx, y: before.y - size.h / 2 + sy };
      const anchor = unproject(anchorWorld.x, anchorWorld.y, v.z);
      const a2 = project(anchor.lat, anchor.lng, z);
      return { z, c: unproject(a2.x - sx + size.w / 2, a2.y - sy + size.h / 2, z) };
    });
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) < 60) return;
      const r = el.getBoundingClientRect();
      zoomAt(acc < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
      acc = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current = null;
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, cx: cpx.x, cy: cpx.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d / pinch.current > 1.4) {
        zoomAt(1);
        pinch.current = d;
      } else if (d / pinch.current < 0.7) {
        zoomAt(-1);
        pinch.current = d;
      }
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setView((v) => ({ ...v, c: unproject(d.cx - dx, d.cy - dy, v.z) }));
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && onPick && pointers.current.size === 0) {
      const r = box.current!.getBoundingClientRect();
      onPick(unproject(left + e.clientX - r.left, top + e.clientY - r.top, view.z));
    }
  };

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setView({ c, z: Math.max(view.z, 14) });
        onLocate?.(c);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const linePts = line?.map((p) => toScreen(p.lat, p.lng)) ?? [];
  return (
    <div
      ref={box}
      className={cx('relative h-80 touch-none select-none overflow-hidden rounded-2xl bg-[#E8E4D8] ring-1 ring-cream-200', onPick ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing', className)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={(e) => {
        const r = box.current!.getBoundingClientRect();
        zoomAt(1, e.clientX - r.left, e.clientY - r.top);
      }}
      role="application"
      aria-label="Map"
    >
      {tiles.map((t) => (
        <img key={t.key} src={t.src} alt="" draggable={false} data-fallback="1" className="pointer-events-none absolute max-w-none" style={{ left: t.x, top: t.y, width: TILE, height: TILE }} />
      ))}
      {linePts.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline points={linePts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1F6B45" strokeWidth={4} strokeDasharray="10 8" strokeLinecap="round" opacity={0.85} />
        </svg>
      )}
      {markers.map((m) => {
        const p = toScreen(m.lat, m.lng);
        if (p.x < -40 || p.y < -40 || p.x > size.w + 40 || p.y > size.h + 40) return null;
        return (
          <button
            key={m.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              m.onClick?.();
            }}
            className={cx('absolute flex -translate-x-1/2 -translate-y-full flex-col items-center', m.active ? 'z-20' : 'z-10')}
            style={{ left: p.x, top: p.y }}
            title={m.label}
            aria-label={m.label}
          >
            {m.label && m.active && <span className="mb-1 max-w-[180px] truncate rounded-lg bg-white px-2 py-1 text-xs font-bold text-ink shadow-lg">{m.label}</span>}
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white text-white shadow-lg" style={{ background: m.color ?? '#1F6B45' }}>
              {m.pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: m.color ?? '#1F6B45' }} />}
              <span className="relative">{m.icon}</span>
            </span>
            <span className="-mt-1 h-2.5 w-2.5 rotate-45 border-b-[3px] border-r-[3px] border-white" style={{ background: m.color ?? '#1F6B45' }} />
          </button>
        );
      })}
      {pick && (() => {
        const p = toScreen(pick.lat, pick.lng);
        return <span className="pointer-events-none absolute z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-danger shadow-lg" style={{ left: p.x, top: p.y }} />;
      })()}
      <div className="absolute right-3 top-3 z-30 flex flex-col overflow-hidden rounded-xl bg-white shadow-lg" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomAt(1)} className="flex h-9 w-9 items-center justify-center hover:bg-cream-100" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
        <button type="button" onClick={() => zoomAt(-1)} className="flex h-9 w-9 items-center justify-center border-t border-cream-200 hover:bg-cream-100" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
        {'geolocation' in navigator && <button type="button" onClick={locate} className="flex h-9 w-9 items-center justify-center border-t border-cream-200 text-brand hover:bg-cream-100" aria-label="My location"><Crosshair className="h-4 w-4" /></button>}
      </div>
      <span className="pointer-events-none absolute bottom-1 right-1 z-30 rounded bg-white/80 px-1.5 text-[10px] text-ink-soft">© OpenStreetMap</span>
    </div>
  );
}
