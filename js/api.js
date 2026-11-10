// Lớp gọi API duy nhất của giao diện. Chuyển giữa mock và backend thật bằng CONFIG.USE_MOCK.
import { CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.message) || 'Lỗi không xác định');
    this.status = status;
    this.errorCode = body && body.errorCode;
    this.details = body && body.details;
    this.requestId = body && body.requestId;
  }
}

const TOKEN_KEY = 'ntv_admin_token';
export const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

let mockHandle = null;
async function request(method, path, { query, body, version } = {}) {
  const q = {};
  for (const [k, v] of Object.entries(query || {})) if (v !== '' && v != null) q[k] = v;
  let res;
  if (CONFIG.USE_MOCK) {
    if (!mockHandle) mockHandle = (await import('./mock/server.js')).handle;
    res = await mockHandle({ method, path, query: q, body, token: getToken(), ifMatch: version });
  } else {
    const qs = new URLSearchParams(q).toString();
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers.Authorization = 'Bearer ' + t;
    if (version != null) headers['If-Match'] = String(version);
    const r = await fetch(CONFIG.API_BASE_URL + path + (qs ? '?' + qs : ''), { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'include' });
    let data = null;
    try { data = await r.json(); } catch { /* không có body */ }
    res = r.ok ? { status: r.status, data } : { status: r.status, error: data || {} };
  }
  if (res.error) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(res.status, res.error);
  }
  return res.data;
}

export const api = {
  get: (p, query) => request('GET', p, { query }),
  post: (p, body) => request('POST', p, { body }),
  patch: (p, body, version) => request('PATCH', p, { body, version }),
  del: (p, body) => request('DELETE', p, { body }),
};
