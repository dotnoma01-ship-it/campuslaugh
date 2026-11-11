export const API_BASE_URL = (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? 'http://localhost:5001/api';
const BASE = API_BASE_URL.replace(/\/$/, '');
let accessToken = sessionStorage.getItem('campuslaugh:access');
let refreshInFlight: Promise<string> | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) sessionStorage.setItem('campuslaugh:access', token);
  else sessionStorage.removeItem('campuslaugh:access');
  window.dispatchEvent(new Event('campuslaugh:session'));
};
export const getAccessToken = () => accessToken;

export function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.accessToken !== 'string') throw new Error(body.message ?? 'Your session expired. Sign in again.');
        setAccessToken(body.accessToken);
        return body.accessToken as string;
      })
      .catch((error) => { setAccessToken(null); throw error; })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

const canRefreshFor = (path: string) => ![
  '/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password',
].includes(path.split('?', 1)[0]!);

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
  };
  let response = await send(accessToken);
  if (response.status === 401 && canRefreshFor(path)) {
    try { response = await send(await refreshAccessToken()); }
    catch { /* Keep the original response so callers receive its safe API message. */ }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}
