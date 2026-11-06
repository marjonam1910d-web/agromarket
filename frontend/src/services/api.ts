/**
 * API klienti: HttpOnly cookie sessiya + CSRF (double-submit) + 401 bo'lganda bir marta refresh.
 * Barcha javoblar { success, data, meta } formatida.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export interface Paged<T> {
  data: T;
  meta: { total: number; page: number; limit: number; pages: number; [k: string]: unknown };
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1';

function csrfToken() {
  const m = document.cookie.match(/(?:^|; )am_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

let csrfReady: Promise<void> | null = null;
async function ensureCsrf() {
  if (csrfToken()) return;
  csrfReady ??= fetch(`${BASE}/auth/csrf`, { credentials: 'include' }).then(() => undefined);
  await csrfReady;
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      await ensureCsrf();
      const r = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken() } });
      return r.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

type Opts = { method?: string; body?: unknown; headers?: Record<string, string>; raw?: boolean; signal?: AbortSignal; noRefresh?: boolean };

async function request<T>(path: string, opts: Opts = {}, retried = false): Promise<{ data: T; meta?: Paged<T>['meta'] }> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const isForm = opts.body instanceof FormData;
  if (method !== 'GET') await ensureCsrf();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      signal: opts.signal,
      headers: {
        ...(isForm || opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(method !== 'GET' ? { 'x-csrf-token': csrfToken() } : {}),
        'Accept-Language': localStorage.getItem('am_lang') ?? 'uz',
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', "Server bilan aloqa yo'q");
  }
  if (res.status === 401 && !retried && !opts.noRefresh && !path.startsWith('/auth/')) {
    if (await refresh()) return request<T>(path, opts, true);
  }
  if (res.status === 403 && !retried) {
    const peek = await res.clone().json().catch(() => null);
    if (peek?.error?.code === 'CSRF_INVALID') {
      csrfReady = null;
      document.cookie = 'am_csrf=; Max-Age=0; path=/';
      await ensureCsrf();
      return request<T>(path, opts, true);
    }
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err: ApiErrorBody = json?.error ?? { code: 'INTERNAL', message: res.statusText };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return { data: json.data as T, meta: json.meta };
}

export const api = {
  get: async <T>(path: string, signal?: AbortSignal) => (await request<T>(path, { signal })).data,
  page: async <T>(path: string) => (await request<T>(path)) as Paged<T>,
  post: async <T>(path: string, body?: unknown, headers?: Record<string, string>) => (await request<T>(path, { method: 'POST', body, headers })).data,
  put: async <T>(path: string, body?: unknown) => (await request<T>(path, { method: 'PUT', body })).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>(path, { method: 'PATCH', body })).data,
  del: async <T>(path: string) => (await request<T>(path, { method: 'DELETE' })).data,
  upload: async <T>(path: string, form: FormData) => (await request<T>(path, { method: 'POST', body: form })).data,
};

/** Query string yaratish (bo'sh qiymatlar tashlab yuboriladi) */
export function qs(params: Record<string, unknown>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}

/** Server rasmlari: absolute URL yoki /uploads/... */
export function img(url?: string | null) {
  if (!url) return '/placeholder.svg';
  return url;
}
