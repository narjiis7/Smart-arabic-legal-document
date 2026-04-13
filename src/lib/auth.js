import { apiFetch, isApiConfigured, useMockAuth, messageFromApiErrorBody } from './api.js';
import { refreshSession, getBearerToken } from './session.js';

/** مسار POST لتحديث التوكن — يُحدَّد حسب طريقة الدخول (Swagger: نفس جسم JSON string للريفريش) */
const REFRESH_PATH_KEY = 'legal_app_refresh_path';
const REVOKE_PATH_KEY = 'legal_app_revoke_path';

function setMiniAuthEndpoints() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(REFRESH_PATH_KEY, '/api/mini/auth/refresh-token');
  sessionStorage.setItem(REVOKE_PATH_KEY, '/api/mini/auth/revoke-token');
}

function setWebsiteAuthEndpoints() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(REFRESH_PATH_KEY, '/api/auth/refresh-token');
  sessionStorage.setItem(REVOKE_PATH_KEY, '/api/auth/revoke-token');
}

function clearAuthEndpointKeys() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(REFRESH_PATH_KEY);
  sessionStorage.removeItem(REVOKE_PATH_KEY);
}

function getStoredRefreshPath() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(REFRESH_PATH_KEY)?.trim() || '';
}

function getStoredRevokePath() {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(REVOKE_PATH_KEY)?.trim() || '';
}

class AuthError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} [httpStatus] رمز HTTP من السيرفر (400، 500، …)
   */
  constructor(message, code, httpStatus) {
    super(message);
    this.name = 'AuthError';
    /** @type {string} */
    this.code = code;
    /** @type {number | undefined} */
    this.httpStatus = httpStatus;
  }
}

/** يظهر في الواجهة: [HTTP 400] … أو [HTTP 500] … */
function withHttpStatus(status, detail) {
  const d = (detail || '').trim() || 'بدون تفاصيل من السيرفر';
  return `[HTTP ${status}] ${d}`;
}

function parseJsonSafe(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** استخراج الحقول من رد تسجيل الدخول (.NET قد يستخدم PascalCase) */
function pick(obj) {
  if (!obj || typeof obj !== 'object')
    return { token: '', refresh: '', fullName: '', email: '', userId: '', role: '' };
  /** توكن مخصص لمسارات Mini (إن رجعه الباكند مع أو بدون accessToken عام) */
  const token =
    obj.miniAccessToken ??
    obj.MiniAccessToken ??
    obj.miniToken ??
    obj.MiniToken ??
    obj.miniJwt ??
    obj.MiniJwt ??
    obj.accessToken ??
    obj.AccessToken ??
    obj.access ??
    obj.Access ??
    obj.token ??
    obj.Token ??
    obj.jwt ??
    obj.Jwt ??
    obj.access_token ??
    '';
  const refresh =
    obj.refreshToken ??
    obj.RefreshToken ??
    obj.refresh ??
    obj.Refresh ??
    obj.refresh_token ??
    '';
  const fullName = obj.fullName ?? obj.FullName ?? obj.name ?? '';
  const email = obj.email ?? obj.Email ?? '';
  const userId = obj.userId ?? obj.UserId ?? obj.sub ?? '';
  const role = obj.role ?? obj.Role ?? '';
  return { token, refresh, fullName, email, userId, role };
}

/** يبحث في غلاف الاستجابة (.NET: Data / Result / Value). */
function pickLoginPayload(data) {
  if (!data || typeof data !== 'object') return pick(null);
  let p = pick(data);
  if (p.token) return p;
  const shells = [
    data.data,
    data.Data,
    data.result,
    data.Result,
    data.value,
    data.Value,
  ];
  for (const shell of shells) {
    if (!shell || typeof shell !== 'object') continue;
    p = pick(shell);
    if (p.token) return p;
    const inner = [shell.data, shell.Data, shell.result, shell.Result];
    for (const x of inner) {
      if (!x || typeof x !== 'object') continue;
      p = pick(x);
      if (p.token) return p;
    }
  }
  return pick(data);
}

/**
 * بعد دخول البريد على المسار العام: يحاول JWT مقبول لـ /api/mini/* إن وفره الباكند.
 * - VITE_MINI_EMAIL_LOGIN_PATH: مسار POST مخصص (نفس جسم البريد/كلمة المرور).
 * - أو VITE_MINI_AUTH_WITH_EMAIL=true مع POST الافتراضي /api/mini/auth/login بنفس الجسم.
 * إن فشل أو غير مضبوط يُبقى التوكن الأول دون أخطاء للمستخدم.
 */
async function tryAcquireMiniUserJwt(email, password) {
  const custom =
    typeof import.meta.env.VITE_MINI_EMAIL_LOGIN_PATH === 'string' &&
    import.meta.env.VITE_MINI_EMAIL_LOGIN_PATH.trim();
  const useBuiltin =
    import.meta.env.VITE_MINI_AUTH_WITH_EMAIL === 'true' ||
    import.meta.env.VITE_MINI_AUTH_WITH_EMAIL === '1';
  const path = (custom && custom.trim()) || (useBuiltin ? '/api/mini/auth/login' : '');
  if (!path) return;

  const emailBodyMode =
    typeof import.meta.env.VITE_EMAIL_LOGIN_BODY === 'string'
      ? import.meta.env.VITE_EMAIL_LOGIN_BODY.trim().toLowerCase()
      : '';
  const payload =
    emailBodyMode === 'pascal'
      ? { Email: email, Password: password }
      : { email, password };

  let res;
  try {
    res = await apiFetch(path, {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(payload),
    });
  } catch {
    return;
  }
  const text = await res.text();
  if (!res.ok) return;
  const data = parseJsonSafe(text);
  if (!data || typeof data !== 'object') return;
  const p2 = pickLoginPayload(data);
  if (!p2.token) return;

  const prevRefresh = localStorage.getItem('refreshToken') || '';
  const prevName = sessionStorage.getItem('userFullName') || '';
  const prevUid = sessionStorage.getItem('userId') || '';
  const prevRole = localStorage.getItem('role') || '';
  applyUserSession(
    {
      token: p2.token,
      refresh: p2.refresh || prevRefresh,
      fullName: p2.fullName || prevName,
      email: p2.email || email,
      userId: p2.userId || prevUid,
      role: p2.role || prevRole,
    },
    email,
  );
}

/** accessToken + نسخة متزامنة في sessionStorage.token؛ تحديث store الجلسة لكل الصفحات */
function applyUserSession(p, fallbackLabel) {
  localStorage.setItem('accessToken', p.token);
  if (p.token) sessionStorage.setItem('token', p.token);
  else sessionStorage.removeItem('token');
  if (p.refresh) localStorage.setItem('refreshToken', p.refresh);
  else localStorage.removeItem('refreshToken');
  if (p.role) localStorage.setItem('role', String(p.role));
  else localStorage.removeItem('role');
  if (p.fullName) sessionStorage.setItem('userFullName', p.fullName);
  else sessionStorage.removeItem('userFullName');
  sessionStorage.setItem('userEmail', p.email || fallbackLabel || '—');
  if (p.userId) sessionStorage.setItem('userId', String(p.userId));
  else sessionStorage.removeItem('userId');
  refreshSession();
  void import('./notificationUnread.js')
    .then((m) => m.refreshNotificationUnread())
    .catch(() => {});
}

/** دخول تجريبي أو حفظ توكن من مصدر خارجي — نفس مسار الدخول الحقيقي لكل الصفحات */
export function storeSessionToken(token, fallbackLabel = '—') {
  const t = (token || '').trim();
  if (!t) {
    void logout();
    return;
  }
  setMiniAuthEndpoints();
  applyUserSession(
    { token: t, refresh: '', fullName: '', email: '', userId: '', role: '' },
    fallbackLabel,
  );
}

/** جسم refresh/revoke كما في Swagger: نص JSON أو كائن — يطابق VITE_MINI_REFRESH_BODY */
function buildMiniRefreshRevokeBody(rt) {
  const bodyMode = (
    typeof import.meta.env.VITE_MINI_REFRESH_BODY === 'string'
      ? import.meta.env.VITE_MINI_REFRESH_BODY
      : ''
  )
    .trim()
    .toLowerCase();
  if (bodyMode === 'object' || bodyMode === 'camel') {
    return JSON.stringify({ refreshToken: rt });
  }
  if (bodyMode === 'pascal') {
    return JSON.stringify({ RefreshToken: rt });
  }
  return JSON.stringify(rt);
}

/**
 * Swagger: POST /api/mini/auth/refresh-token — يعيد accessToken و refreshToken (عام، بدون Bearer).
 * جسم الطلب الافتراضي: JSON نصي فقط، أي `JSON.stringify(refreshToken)` → `"eyJ..."`.
 * إن احتاج الباكند كائناً: VITE_MINI_REFRESH_BODY=object أو pascal.
 *
 * @returns {Promise<boolean>} نجح التحديث وحُفظ accessToken
 */
export async function refreshMiniAccessToken() {
  if (useMockAuth()) return false;
  if (!isApiConfigured()) return false;
  const rt =
    typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken')?.trim() || '' : '';
  if (!rt) return false;

  const refreshPath =
    getStoredRefreshPath() ||
    (typeof import.meta.env.VITE_MINI_REFRESH_PATH === 'string' &&
      import.meta.env.VITE_MINI_REFRESH_PATH.trim()) ||
    '/api/mini/auth/refresh-token';

  const body = buildMiniRefreshRevokeBody(rt);

  let res;
  try {
    res = await apiFetch(refreshPath, {
      method: 'POST',
      skipAuth: true,
      body,
    });
  } catch {
    return false;
  }
  const text = await res.text();
  if (!res.ok) return false;
  const data = parseJsonSafe(text);
  if (!data || typeof data !== 'object') return false;
  const p = pickLoginPayload(data);
  if (!p.token) return false;

  const prevName = sessionStorage.getItem('userFullName') || '';
  const prevUid = sessionStorage.getItem('userId') || '';
  const prevRole = localStorage.getItem('role') || '';
  const fallbackEmail = p.email || sessionStorage.getItem('userEmail') || '—';
  const nextRefresh = (p.refresh && String(p.refresh).trim()) || rt;

  applyUserSession(
    {
      token: p.token,
      refresh: nextRefresh,
      fullName: p.fullName || prevName,
      email: p.email || '',
      userId: p.userId || prevUid,
      role: p.role || prevRole,
    },
    fallbackEmail,
  );
  return true;
}

/**
 * تسجيل الدخول عبر Mini-app حسب Swagger: POST /api/mini/auth/login
 * الجسم: { "superQiToken": "..." } — توكن يصدره تطبيق SuperQi بعد المصادقة.
 */
export async function loginWithSuperQiToken(superQiToken) {
  const t = (superQiToken || '').trim();

  if (useMockAuth()) {
    setMiniAuthEndpoints();
    applyUserSession(
      { token: 'mock-dev-token', refresh: '', fullName: '', email: '', userId: '', role: '' },
      t || undefined,
    );
    return { token: 'mock-dev-token' };
  }

  if (!t) {
    throw new AuthError('أدخل رمز SuperQi (أو استخدم زر SuperQi إن وُجد).', 'VALIDATION');
  }

  if (!isApiConfigured()) {
    throw new AuthError('NO_API_BASE', 'NO_API_BASE');
  }

  const path =
    (typeof import.meta.env.VITE_LOGIN_PATH === 'string' && import.meta.env.VITE_LOGIN_PATH.trim()) ||
    '/api/mini/auth/login';

  const res = await apiFetch(path, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ superQiToken: t }),
  });
  const text = await res.text();

  if (!res.ok) {
    const errObj = parseJsonSafe(text);
    const detail = messageFromApiErrorBody(errObj, text) || text;
    const code = res.status === 400 ? 'VALIDATION' : 'BAD_CREDENTIALS';
    throw new AuthError(withHttpStatus(res.status, detail), code, res.status);
  }

  const data = parseJsonSafe(text);
  if (!data || typeof data !== 'object') {
    throw new AuthError('استجابة غير صالحة من السيرفر بعد تسجيل الدخول.', 'NO_TOKEN');
  }

  let p = pickLoginPayload(data);

  if (!p.token) {
    throw new AuthError(
      'لم يُرجع السيرفر accessToken. راجع استجابة Swagger بعد تسجيل الدخول.',
      'NO_TOKEN',
    );
  }

  setMiniAuthEndpoints();
  applyUserSession(p, p.email || t);
  return { token: p.token, user: data };
}

/**
 * دخول اختياري ببريد وكلمة مرور — مسار منفصل (مثلاً لوحة إدارية)، ليس مسار Mini-app.
 * POST {VITE_EMAIL_LOGIN_PATH أو /api/Auth/login}
 */
export async function loginWithEmailPassword(email, password) {
  const trimmedEmail = (email || '').trim();

  if (useMockAuth()) {
    setWebsiteAuthEndpoints();
    applyUserSession(
      {
        token: 'mock-dev-token',
        refresh: '',
        fullName: '',
        email: trimmedEmail,
        userId: '',
        role: '',
      },
      trimmedEmail,
    );
    return { token: 'mock-dev-token' };
  }

  if (!trimmedEmail || !password) {
    throw new AuthError('أدخل البريد وكلمة المرور', 'VALIDATION');
  }

  if (!isApiConfigured()) {
    throw new AuthError('NO_API_BASE', 'NO_API_BASE');
  }

  const emailPath =
    (typeof import.meta.env.VITE_EMAIL_LOGIN_PATH === 'string' &&
      import.meta.env.VITE_EMAIL_LOGIN_PATH.trim()) ||
    '/api/auth/login';

  const emailBodyMode =
    typeof import.meta.env.VITE_EMAIL_LOGIN_BODY === 'string'
      ? import.meta.env.VITE_EMAIL_LOGIN_BODY.trim().toLowerCase()
      : '';
  const emailPayload =
    emailBodyMode === 'pascal'
      ? { Email: trimmedEmail, Password: password }
      : { email: trimmedEmail, password };

  const res = await apiFetch(emailPath, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(emailPayload),
  });
  const text = await res.text();

  if (!res.ok) {
    const errObj = parseJsonSafe(text);
    const detail = messageFromApiErrorBody(errObj, text) || text;
    const code = res.status === 400 ? 'VALIDATION' : 'BAD_CREDENTIALS';
    throw new AuthError(withHttpStatus(res.status, detail), code, res.status);
  }

  const data = parseJsonSafe(text);
  if (!data || typeof data !== 'object') {
    throw new AuthError('استجابة غير صالحة من السيرفر.', 'NO_TOKEN');
  }

  let p = pickLoginPayload(data);

  if (!p.token) {
    throw new AuthError('لم يُرجع السيرفر رمز دخول.', 'NO_TOKEN');
  }

  /** POST /api/auth/login — تحديث/إلغاء الريفريش عبر مسارات Website (Swagger) */
  setWebsiteAuthEndpoints();
  applyUserSession(p, trimmedEmail);
  /** إن احتاج الباكند JWT منفرداً لـ mini مع نفس البريد: فعّل VITE_MINI_AUTH_WITH_EMAIL ومساراً يقبل email/password */
  await tryAcquireMiniUserJwt(trimmedEmail, password);

  return { token: getBearerToken() || p.token, user: data };
}

function clearClientSessionOnly() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('role');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('userEmail');
  sessionStorage.removeItem('userFullName');
  sessionStorage.removeItem('userId');
  sessionStorage.removeItem('role');
  clearAuthEndpointKeys();
  refreshSession();
  void import('./notificationUnread.js')
    .then((m) => m.setNotificationUnread(0))
    .catch(() => {});
}

/**
 * Swagger: POST /api/mini/auth/revoke-token — إلغاء refresh token (logout)، يتطلب JWT (Bearer).
 * ثم يمسح التخزين المحلي حتى لو فشل الطلب.
 */
export async function logout() {
  const rt =
    typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken')?.trim() || '' : '';
  const canCallServer =
    !useMockAuth() && isApiConfigured() && rt && getBearerToken();

  if (canCallServer) {
    const revokePath =
      getStoredRevokePath() ||
      (typeof import.meta.env.VITE_MINI_REVOKE_PATH === 'string' &&
        import.meta.env.VITE_MINI_REVOKE_PATH.trim()) ||
      '/api/mini/auth/revoke-token';
    try {
      await apiFetch(revokePath, {
        method: 'POST',
        skipAuth: false,
        body: buildMiniRefreshRevokeBody(rt),
      });
    } catch {
      /* يُكمَل المسح محلياً */
    }
  }

  clearClientSessionOnly();
}

/** قراءة حمولة JWT بدون تحقق (للعرض فقط). */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
