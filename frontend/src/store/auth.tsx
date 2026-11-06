import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/services/api';
import { useI18n, type Lang } from '@/i18n';
import type { User } from '@/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
  reload: () => Promise<unknown>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { lang, setLang } = useI18n();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<User>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // access token tugagan bo'lishi mumkin — refresh urinib ko'ramiz
          const r = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-csrf-token': decodeURIComponent(document.cookie.match(/(?:^|; )am_csrf=([^;]+)/)?.[1] ?? '') },
          }).catch(() => null);
          if (r?.ok) return api.get<User>('/auth/me');
          return null;
        }
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const user = me.data ?? null;
  // Foydalanuvchining saqlangan tilini qo'llash
  useEffect(() => {
    if (user?.locale && user.locale !== lang) setLang(user.locale as Lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setUser = useCallback((u: User | null) => qc.setQueryData(['me'], u), [qc]);
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    qc.setQueryData(['me'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' && q.queryKey[0] !== 'public' });
  }, [qc]);

  return (
    <Ctx.Provider value={{ user, loading: me.isLoading, setUser, logout, reload: me.refetch }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('AuthProvider kerak');
  return c;
}
