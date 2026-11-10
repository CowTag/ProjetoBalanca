const BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'cowtag_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

type Opts = Omit<RequestInit, 'body'> & { json?: unknown };

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });

  if (res.status === 401 && token) {
    tokenStore.clear();
    window.location.href = '/login';
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'ERRO', data.message ?? data.error);
  return data as T;
}

export const apiBase = BASE;
