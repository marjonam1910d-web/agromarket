import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, qs } from '@/services/api';
import { useI18n, type TKey } from '@/i18n';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import type { Quote, Region } from '@/types';

export function useDebounce<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useRegions() {
  const { lang } = useI18n();
  const q = useQuery({ queryKey: ['public', 'regions'], queryFn: () => api.get<Region[]>('/meta/regions'), staleTime: Infinity });
  const regions = q.data ?? [];
  const regionName = (code?: string | null) => {
    const r = regions.find((x) => x.code === code);
    return r ? r[lang] : code ?? '';
  };
  return { regions, regionName, loading: q.isLoading };
}

export interface PublicConfig {
  paymentMethods: Record<'cash' | 'payme' | 'click' | 'card', boolean>;
  paymentSandbox: boolean;
  otpDevEcho: boolean;
  demoMode?: boolean;
  deliverySlots: string[];
  maxDaysAhead: number;
  supportPhone: string;
}
export function useConfig() {
  return useQuery({ queryKey: ['public', 'config'], queryFn: () => api.get<PublicConfig>('/meta/config'), staleTime: 10 * 60_000 });
}

/** Xato xabarini joriy tilda (kod bo'yicha) chiqarish */
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown) => {
    if (e instanceof ApiError) {
      const key = `errors.${e.code}` as TKey;
      const tr = t(key);
      return tr === key ? e.message : tr;
    }
    return t('common.error');
  };
}

export function useCart(params: { region?: string; district?: string } = {}) {
  const { user } = useAuth();
  const enabled = Boolean(user && user.role !== 'ADMIN');
  return useQuery({ queryKey: ['cart', params.region ?? '', params.district ?? ''], queryFn: () => api.get<Quote>(`/cart${qs(params)}`), enabled, staleTime: 15_000 });
}

export function useCartActions() {
  const qc = useQueryClient();
  const toast = useToast();
  const err = useErrorText();
  const { t } = useI18n();
  const onSuccess = (data: Quote) => {
    qc.setQueryData(['cart', '', ''], data);
    void qc.invalidateQueries({ queryKey: ['cart'], refetchType: 'active' });
  };
  const add = useMutation({
    mutationFn: (v: { productId: string; quantity: number; mode?: 'add' | 'set' }) => api.post<Quote>('/cart/items', v),
    onSuccess: (d) => {
      onSuccess(d);
      toast(t('product.added'));
    },
    onError: (e) => toast(err(e), 'error'),
  });
  const update = useMutation({ mutationFn: (v: { id: string; quantity: number }) => api.patch<Quote>(`/cart/items/${v.id}`, { quantity: v.quantity }), onSuccess, onError: (e) => toast(err(e), 'error') });
  const remove = useMutation({ mutationFn: (id: string) => api.del<Quote>(`/cart/items/${id}`), onSuccess });
  const coupon = useMutation({ mutationFn: (code: string | null) => api.post<Quote>('/cart/coupon', { code }), onSuccess, onError: (e) => toast(err(e), 'error') });
  const clear = useMutation({ mutationFn: () => api.del<Quote>('/cart'), onSuccess });
  return { add, update, remove, coupon, clear };
}

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ids = useQuery({ queryKey: ['favorites', 'ids'], queryFn: () => api.get<string[]>('/favorites/ids'), enabled: Boolean(user) });
  const toggle = useMutation({
    mutationFn: async (productId: string) => {
      const on = ids.data?.includes(productId);
      if (on) await api.del(`/favorites/${productId}`);
      else await api.post('/favorites', { productId });
      return { productId, on: !on };
    },
    onMutate: (productId) => {
      qc.setQueryData<string[]>(['favorites', 'ids'], (old = []) => (old.includes(productId) ? old.filter((x) => x !== productId) : [...old, productId]));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
  return { ids: new Set(ids.data ?? []), toggle };
}

/** WebSocket: bildirishnoma, xabar va buyurtma yangilanishlarini real vaqtda olish */
export function useRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const retry = useRef(0);
  useEffect(() => {
    if (!user) return;
    let ws: WebSocket | null = null;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => (retry.current = 0);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as { type: string; payload: { title?: string; body?: string; conversationId?: string } };
          if (msg.type === 'notification') {
            void qc.invalidateQueries({ queryKey: ['notifications'] });
            if (msg.payload.title && msg.payload.title !== '') toast(`${msg.payload.title}`, 'info');
          }
          if (msg.type === 'message' || msg.type === 'unread') {
            void qc.invalidateQueries({ queryKey: ['conversations'] });
            void qc.invalidateQueries({ queryKey: ['notifications', 'count'] });
          }
          if (msg.type === 'order_update') {
            void qc.invalidateQueries({ queryKey: ['orders'] });
            void qc.invalidateQueries({ queryKey: ['seller-orders'] });
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (stop) return;
        retry.current = Math.min(retry.current + 1, 6);
        timer = setTimeout(connect, 1000 * 2 ** retry.current);
      };
    };
    connect();
    return () => {
      stop = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [user, qc, toast]);
}

export function useUnreadCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => api.get<{ notifications: number; messages: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });
}

export function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const f = () => setR(m.matches);
    m?.addEventListener?.('change', f);
    return () => m?.removeEventListener?.('change', f);
  }, []);
  return r;
}
