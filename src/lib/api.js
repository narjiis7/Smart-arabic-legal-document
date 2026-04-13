/**
 * عنوان الـ API الأساسي من .env → VITE_API_BASE_URL
 * للتطوير مع بروكسي Vite: اترك VITE_API_BASE_URL فارغاً واضبط VITE_API_PROXY_TARGET
 */

import { getBearerToken } from './session.js';

export function getApiBase() {
  const u = import.meta.env.VITE_API_BASE_URL;
  if (typeof u !== 'string' || !u.trim()) return '';
  return u.trim().replace(/\/$/, '');
}

/** وضع تطوير الواجهة فقط — بدون باكند حتى تضبط VITE_API_BASE_URL لاحقاً. */
export function isFrontendOnly() {
  const v = import.meta.env.VITE_FRONTEND_ONLY;
  return v === 'true' || v === '1';
}

/**
 * هل طلبات الـ API ستصل لخادم حقيقي؟
 * - إما VITE_API_BASE_URL مضبوط → الطلبات للدومين الكامل.
 * - أو وضع التطوير + VITE_API_PROXY_TARGET → الطلبات النسبية /api/* تمر عبر بروكسي Vite.
 * - VITE_FRONTEND_ONLY يعطّل الربط بالكامل (مع بيانات تجريبية في الواجهة).
 */
export function isApiConfigured() {
  if (isFrontendOnly()) return false;
  if (getApiBase()) return true;
  if (import.meta.env.DEV) {
    const p = import.meta.env.VITE_API_PROXY_TARGET;
    return typeof p === 'string' && !!p.trim();
  }
  return false;
}

/** بدون باكند + وضع تجريبي: دوال mini ترجع بيانات وهمية بدل fetch. */
function useLocalMiniMock() {
  return !isApiConfigured() && useMockAuth();
}

let warnedApiMisconfig = false;

export function apiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * @param {string} path
 * @param {RequestInit & { skipAuth?: boolean; _authRetry?: boolean }} options
 */
export async function apiFetch(path, options = {}) {
  if (!warnedApiMisconfig && !isApiConfigured() && !isFrontendOnly()) {
    warnedApiMisconfig = true;
    console.warn(
      '[legal-app] إعداد الخادم ناقص: لا يوجد VITE_API_BASE_URL ولا VITE_API_PROXY_TARGET (في التطوير). ' +
        'الطلبات تذهب إلى نفس عنوان الصفحة (مثل localhost:5173) ولن تجد الـ API. ' +
        'ضع عنوان الـ API في .env ثم أعد تشغيل npm run dev.',
    );
  }
  if (!isApiConfigured() && isFrontendOnly()) warnedApiMisconfig = true;

  const { skipAuth, headers: hdr, _authRetry, ...rest } = options;
  const headers = new Headers(hdr);

  if (!headers.has('Content-Type') && rest.body && typeof rest.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getBearerToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const url = apiUrl(path);
  const init = { ...rest, headers };

  const allowRefreshOn401 =
    import.meta.env.VITE_MINI_REFRESH_ON_401 !== 'false' &&
    import.meta.env.VITE_MINI_REFRESH_ON_401 !== '0';

  try {
    const res = await fetch(url, init);
    if (
      res.status === 401 &&
      !skipAuth &&
      !_authRetry &&
      allowRefreshOn401 &&
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('refreshToken')?.trim()
    ) {
      const { refreshMiniAccessToken } = await import('./auth.js');
      const ok = await refreshMiniAccessToken();
      if (ok) {
        return apiFetch(path, { ...options, _authRetry: true });
      }
    }
    return res;
  } catch (err) {
    const msg = err && typeof err.message === 'string' ? err.message : '';
    const retryable =
      err instanceof TypeError ||
      /fetch failed|networkerror|failed to fetch|load failed|aborted|timeout/i.test(msg);
    if (retryable) {
      await new Promise((r) => setTimeout(r, 750));
      return await fetch(url, init);
    }
    throw err;
  }
}

export function useMockAuth() {
  if (isFrontendOnly()) return true;
  return import.meta.env.VITE_MOCK_AUTH === 'true';
}

/** باكند قد يرجع مصفوفة مباشرة أو { items|data|results } ونسخ PascalCase من ASP.NET. */
function unwrapArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.Items)) return data.Items;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.Data)) return data.Data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.Results)) return data.Results;
  }
  return [];
}

/** أول مفتاح موجود على الكائن (قيمة قد تكون null). */
function pickProp(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

/**
 * صف قالب عقد من GET /templates — يوحّد camelCase مع PascalCase (.NET).
 * @param {unknown} item
 */
export function normalizeMiniContractTemplate(item) {
  if (!item || typeof item !== 'object') return item;
  const t = /** @type {Record<string, unknown>} */ (item);
  return {
    id: pickProp(t, 'id', 'Id'),
    type: pickProp(t, 'type', 'Type'),
    nameAr: pickProp(t, 'nameAr', 'NameAr', 'name_ar'),
    descriptionAr: pickProp(t, 'descriptionAr', 'DescriptionAr', 'description_ar'),
    price: pickProp(t, 'price', 'Price'),
    estimatedMinutes: pickProp(t, 'estimatedMinutes', 'EstimatedMinutes'),
    fieldsJson: pickProp(t, 'fieldsJson', 'FieldsJson', 'fields_json'),
  };
}

function unwrapTemplateDetailPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return raw.data ?? raw.Data ?? raw.result ?? raw.Result ?? raw.value ?? raw.Value ?? raw;
}

/**
 * رد GET .../ready-data — أسماء كما في Swagger مع دعم PascalCase.
 * @param {unknown} raw
 */
export function normalizeMiniTemplateReadyData(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const data = r.data ?? r.Data;
  return {
    templateId: pickProp(r, 'templateId', 'TemplateId'),
    templateType: pickProp(r, 'templateType', 'TemplateType'),
    templateNameAr: pickProp(r, 'templateNameAr', 'TemplateNameAr'),
    data: data && typeof data === 'object' && !Array.isArray(data) ? data : {},
  };
}

/**
 * كيان عقد من GET /contracts/{id} أو عناصر قائمة — دمج مع الحقول الأصلية لمرونة العرض.
 * @param {unknown} raw
 */
export function normalizeMiniContractInstance(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const root =
    o.data ??
    o.Data ??
    o.result ??
    o.Result ??
    o.value ??
    o.Value ??
    raw;
  if (!root || typeof root !== 'object') return raw;
  const r = /** @type {Record<string, unknown>} */ (root);
  let idVal = pickProp(r, 'id', 'Id') ?? pickProp(r, 'contractId', 'ContractId');
  if (typeof idVal === 'string' && /^\d+$/.test(idVal.trim())) idVal = Number(idVal.trim());

  const normalized = {
    id: idVal,
    templateName: pickProp(r, 'templateName', 'TemplateName'),
    fileUrl: pickProp(r, 'fileUrl', 'FileUrl'),
    status: pickProp(r, 'status', 'Status'),
    qrToken: pickProp(r, 'qrToken', 'QrToken'),
    expiryDate: pickProp(r, 'expiryDate', 'ExpiryDate'),
    isSignedByOwner: pickProp(r, 'isSignedByOwner', 'IsSignedByOwner'),
    isSignedBySecondParty: pickProp(r, 'isSignedBySecondParty', 'IsSignedBySecondParty'),
    secondPartyName: pickProp(r, 'secondPartyName', 'SecondPartyName', 'second_party_name'),
    secondPartyPhone: pickProp(r, 'secondPartyPhone', 'SecondPartyPhone', 'second_party_phone'),
    createdAt: pickProp(r, 'createdAt', 'CreatedAt'),
    signingToken: pickProp(r, 'signingToken', 'SigningToken'),
    signingLink: pickProp(r, 'signingLink', 'SigningLink'),
    signingUrl: pickProp(r, 'signingUrl', 'SigningUrl'),
    debugOtp: pickProp(r, 'debugOtp', 'DebugOtp', 'debug_otp'),
  };
  return { ...r, ...normalized };
}

/**
 * ASP.NET ProblemDetails: errors = { "field": ["msg1"], "$.data.x": ["..."] }
 */
function flattenValidationErrors(errors) {
  if (!errors || typeof errors !== 'object') return '';
  const lines = [];
  function pushLine(key, m) {
    const s = typeof m === 'string' ? m : m != null ? String(m) : '';
    if (s.trim()) lines.push(key ? `${key}: ${s}` : s);
  }
  function walk(val, keyPrefix) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') pushLine(keyPrefix, item);
        else if (item && typeof item === 'object') walk(item, keyPrefix);
      }
      return;
    }
    for (const [k, v] of Object.entries(val)) {
      const path = keyPrefix ? `${keyPrefix}.${k}` : k;
      if (Array.isArray(v)) {
        for (const m of v) pushLine(path, m);
      } else if (v && typeof v === 'object') {
        walk(v, path);
      } else if (v != null && v !== '') {
        pushLine(path, v);
      }
    }
  }
  walk(errors, '');
  return [...new Set(lines)].join(' — ');
}

/**
 * رسالة خطأ قابلة للعرض من جسم رد API (ASP.NET ProblemDetails + errors كائن).
 * @param {unknown} parsedJson
 * @param {string} rawText
 * @param {number} [maxLen]
 */
export function messageFromApiErrorBody(parsedJson, rawText, maxLen = 1200) {
  if (!parsedJson || typeof parsedJson !== 'object') {
    const t = String(rawText || '').trim();
    return t ? t.slice(0, maxLen) : '';
  }
  const flat = flattenValidationErrors(/** @type {any} */ (parsedJson).errors);
  if (flat) return flat.slice(0, maxLen);
  const j = /** @type {Record<string, unknown>} */ (parsedJson);
  const msg = typeof j.message === 'string' ? j.message.trim() : '';
  if (msg) return msg.slice(0, maxLen);
  if (j.detail) return String(j.detail).slice(0, maxLen);
  if (j.title && String(j.title) !== 'One or more validation errors occurred.') {
    return String(j.title).slice(0, maxLen);
  }
  if (j.error) return String(j.error).slice(0, maxLen);
  const t = String(rawText || '').trim();
  return t ? t.slice(0, maxLen) : '';
}

async function jsonOrThrow(res) {
  const text = await res.text();
  if (res.ok) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }
  let msg = text || `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text);
    if (typeof j === 'string') {
      msg = j;
    } else {
      const fromErrors = flattenValidationErrors(j.errors);
      if (fromErrors) {
        msg = fromErrors.slice(0, 1200);
      } else {
        msg =
          (typeof j.message === 'string' && j.message.trim() ? j.message : '') ||
          j.error ||
          j.detail ||
          j.title ||
          text ||
          `HTTP ${res.status}`;
      }
    }
  } catch {
    /* keep msg */
  }
  const inner = typeof msg === 'string' ? msg.slice(0, 1000) : String(msg);
  const labeled = `[HTTP ${res.status}] ${inner}`.slice(0, 1200);
  /** @type {Error & { status?: number }} */
  const err = Object.assign(new Error(labeled), {
    status: res.status,
  });
  throw err;
}

export async function miniGetMyRequests() {
  if (useLocalMiniMock()) return [];
  const res = await apiFetch('/api/mini/requests/my');
  const data = await jsonOrThrow(res);
  return unwrapArray(data);
}

/**
 * معرفات اختيارية تربط الإشعار بطلب أو عقد (حسب ما يرسله الباكند).
 * @param {Record<string, unknown>} o
 */
function extractNotificationRelatedIds(o) {
  let requestId = pickProp(o, 'requestId', 'RequestId');
  let contractId = pickProp(o, 'contractId', 'ContractId');
  const nested = pickProp(o, 'payload', 'Payload', 'data', 'Data', 'metadata', 'Metadata');
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const p = /** @type {Record<string, unknown>} */ (nested);
    requestId = requestId ?? pickProp(p, 'requestId', 'RequestId');
    contractId = contractId ?? pickProp(p, 'contractId', 'ContractId');
  }
  const relatedRaw = pickProp(o, 'relatedId', 'RelatedId', 'entityId', 'EntityId', 'referenceId', 'ReferenceId');
  const entityType = String(pickProp(o, 'entityType', 'EntityType') ?? '').toLowerCase();
  if (relatedRaw != null && relatedRaw !== '' && requestId == null && contractId == null && entityType) {
    if (entityType.includes('contract') || entityType.includes('عقد')) {
      contractId = relatedRaw;
    } else if (entityType.includes('request') || entityType.includes('طلب')) {
      requestId = relatedRaw;
    }
  }
  return { requestId, contractId };
}

/**
 * حزمة إشعارات المستخدم — Swagger: GET /api/mini/notifications/my → UserNotificationsDto
 * @param {unknown} item
 */
export function normalizeMiniNotification(item) {
  if (!item || typeof item !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (item);
  const { requestId, contractId } = extractNotificationRelatedIds(o);
  return {
    id: pickProp(o, 'id', 'Id'),
    title: pickProp(o, 'title', 'Title'),
    message: pickProp(o, 'message', 'Message'),
    type: pickProp(o, 'type', 'Type'),
    isRead: Boolean(pickProp(o, 'isRead', 'IsRead')),
    createdAt: pickProp(o, 'createdAt', 'CreatedAt'),
    requestId,
    contractId,
  };
}

/** @returns {Promise<{ notifications: ReturnType<typeof normalizeMiniNotification>[]; unreadCount: number }>} */
export async function miniGetMyNotificationsBundle() {
  if (useLocalMiniMock()) {
    return { notifications: [], unreadCount: 0 };
  }
  const res = await apiFetch('/api/mini/notifications/my');
  const raw = await jsonOrThrow(res);
  if (!raw || typeof raw !== 'object') return { notifications: [], unreadCount: 0 };
  const r = /** @type {Record<string, unknown>} */ (raw);
  const arr = Array.isArray(r.notifications)
    ? r.notifications
    : Array.isArray(r.Notifications)
      ? r.Notifications
      : [];
  const unread = Number(r.unreadCount ?? r.UnreadCount) || 0;
  const notifications = arr
    .map((row) => normalizeMiniNotification(row))
    .filter((x) => x != null);
  return { notifications, unreadCount: unread };
}

export async function miniMarkNotificationRead(id) {
  if (useLocalMiniMock()) return { message: 'ok' };
  const res = await apiFetch(`/api/mini/notifications/${encodeURIComponent(String(id))}/read`, {
    method: 'PUT',
  });
  return jsonOrThrow(res);
}

export async function miniMarkAllNotificationsRead() {
  if (useLocalMiniMock()) return { message: 'ok' };
  const envPath =
    typeof import.meta.env.VITE_MINI_NOTIFICATIONS_READ_ALL_PATH === 'string'
      ? import.meta.env.VITE_MINI_NOTIFICATIONS_READ_ALL_PATH.trim()
      : '';
  const paths = envPath
    ? [envPath]
    : ['/api/mini/notifications/read-all', '/api/mini/notifications/read_all'];
  let lastRes = /** @type {Response | null} */ (null);
  for (const path of paths) {
    const res = await apiFetch(path, { method: 'PUT' });
    lastRes = res;
    if (res.ok) return jsonOrThrow(res);
    if (res.status !== 404) {
      const text = await res.text();
      let msg = text || `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text);
        msg = messageFromApiErrorBody(j, text) || msg;
      } catch {
        /* */
      }
      throw Object.assign(new Error(`[HTTP ${res.status}] ${msg}`), { status: res.status });
    }
  }
  const st = lastRes?.status ?? 404;
  throw Object.assign(new Error(`[HTTP ${st}] مسار تعليم الكل كمقروء غير موجود على الخادم.`), {
    status: st,
  });
}

export async function miniCreateRequest(payload) {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 350));
    return {
      id: `local-req-${Date.now()}`,
      ...payload,
    };
  }
  const res = await apiFetch('/api/mini/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return jsonOrThrow(res);
}

/**
 * محاكاة دفع — POST /api/mini/payments/simulate
 * طلب محامٍ: غالباً بعد إنشاء الطلب — amount + consultationRequestId حسب السياق.
 * توليد عقد (Swagger): بعد POST /contracts/generate — amount + generatedContractId (int) لربط الدفعة بالعقد.
 * consultationRequestId: ربط بدفعة **طلب استشارة** على الخادم.
 * generatedContractId: ربط بدفعة **عقد** بعد أن يُرجع التوليد معرّف العقد.
 * paymentContext: نص يميّز نوع التدفق للباكند (مثل contract_generation / lawyer_request) — يُرسَل إن وُجد في payload.
 * @param {{ amount: number, consultationRequestId?: number|string|null, generatedContractId?: number|string|null, paymentContext?: string, purpose?: string }} payload
 */
export async function miniSimulatePayment(payload) {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 320));
    const amount = Number(payload?.amount) || 0;
    const ctx = payload?.paymentContext ?? payload?.purpose;
    return {
      id: `local-pay-${Date.now()}`,
      amount,
      commissionAmount: Math.round(amount * 0.1),
      lawyerAmount: Math.max(0, amount - Math.round(amount * 0.1)),
      method: 'Simulated',
      status: 'Paid',
      externalTransactionId: 'SIX-mock',
      createdAt: new Date().toISOString().slice(0, 10),
      ...(ctx != null && String(ctx).trim() ? { paymentContext: String(ctx).trim() } : {}),
    };
  }
  const amount = Number(payload?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('المبلغ غير صالح'), { code: 'VALIDATION' });
  }
  /** @type {Record<string, unknown>} */
  const body = { amount };
  const cr = payload?.consultationRequestId;
  const gc = payload?.generatedContractId;
  const hasCr = cr != null && cr !== '';
  const hasGc = gc != null && gc !== '';
  if (hasCr && hasGc) {
    throw Object.assign(new Error('لا يُرسل معرّف طلب استشارة ومعرّف عقد معاً في نفس الدفعة.'), {
      code: 'VALIDATION',
    });
  }
  if (hasCr) {
    const n = Number(cr);
    body.consultationRequestId = Number.isFinite(n) ? Math.trunc(n) : cr;
  }
  if (hasGc) {
    const n = Number(gc);
    body.generatedContractId = Number.isFinite(n) ? Math.trunc(n) : gc;
  }

  const ctxRaw = payload?.paymentContext ?? payload?.purpose;
  /** Swagger SimulatePaymentDto: amount + consultationRequestId | generatedContractId فقط — لا paymentContext */
  const sendPayCtx = import.meta.env.VITE_MINI_PAYMENT_SEND_CONTEXT === 'true';
  if (sendPayCtx && ctxRaw != null && String(ctxRaw).trim() !== '') {
    const ctxKey =
      (typeof import.meta.env.VITE_MINI_PAYMENT_CONTEXT_JSON_KEY === 'string' &&
        import.meta.env.VITE_MINI_PAYMENT_CONTEXT_JSON_KEY.trim()) ||
      'paymentContext';
    body[ctxKey] = String(ctxRaw).trim();
  }

  const paths = ['/api/mini/payments/simulate/', '/api/mini/payments/simulate'];
  let lastStatus = 404;
  for (const path of paths) {
    const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
    lastStatus = res.status;
    if (res.ok) return await jsonOrThrow(res);
    if (res.status !== 404) return await jsonOrThrow(res);
  }
  throw Object.assign(new Error(`[HTTP ${lastStatus}] مسار محاكاة الدفع غير موجود على الخادم.`), {
    status: lastStatus,
  });
}

/** هل رد الخادم يعني اكتمال الدفع (محاكاة أو لاحقاً ZainCash). */
export function paymentResponseIsPaid(data) {
  if (!data || typeof data !== 'object') return false;
  const o = /** @type {Record<string, unknown>} */ (data);
  const s = pickProp(o, 'status', 'Status');
  return String(s ?? '').trim().toLowerCase() === 'paid';
}

/**
 * سجل مدفوعات المستخدم — GET /api/mini/payments/my
 * إن لم يوجد المسار على الخادم يُرجع مصفوفة فارغة دون رمي خطأ.
 */
export async function miniGetMyPayments() {
  if (useLocalMiniMock()) return [];
  const paths = ['/api/mini/payments/my/', '/api/mini/payments/my'];
  for (const path of paths) {
    const res = await apiFetch(path);
    if (res.ok) {
      const data = await jsonOrThrow(res);
      return unwrapArray(data);
    }
    if (res.status !== 404) return await jsonOrThrow(res);
  }
  return [];
}

export async function miniGetRequestById(id) {
  if (useLocalMiniMock()) {
    return {
      id,
      serviceType: 'طلب تجريبي',
      status: 'Pending',
      description: '—',
      city: '',
      whatsAppNumber: '',
    };
  }
  const res = await apiFetch(`/api/mini/requests/${encodeURIComponent(String(id))}`);
  return jsonOrThrow(res);
}

/**
 * إلغاء طلب مملوك للمستخدم — Swagger: PUT /api/mini/requests/{id}/cancel
 */
export async function miniCancelRequest(id) {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 200));
    return { id, status: 'Cancelled' };
  }
  const res = await apiFetch(`/api/mini/requests/${encodeURIComponent(String(id))}/cancel`, {
    method: 'PUT',
  });
  return jsonOrThrow(res);
}

/**
 * قائمة محامٍ معتمدين — Swagger: GET /api/mini/lawyers
 */
export async function miniGetLawyers() {
  if (useLocalMiniMock()) return [];
  const res = await apiFetch('/api/mini/lawyers');
  const data = await jsonOrThrow(res);
  return unwrapArray(data);
}

/** Swagger: GET /api/mini/lawyers/{id} */
export async function miniGetLawyerById(id) {
  if (useLocalMiniMock()) return null;
  const res = await apiFetch(`/api/mini/lawyers/${encodeURIComponent(String(id))}`);
  return jsonOrThrow(res);
}

/**
 * تقييمات محامٍ — Swagger: GET /api/mini/reviews/lawyer/{lawyerProfileId}
 */
export async function miniGetLawyerReviews(lawyerProfileId) {
  if (useLocalMiniMock()) return [];
  const id = encodeURIComponent(String(lawyerProfileId));
  const paths = [`/api/mini/reviews/lawyer/${id}/`, `/api/mini/reviews/lawyer/${id}`];
  let lastStatus = 404;
  for (const path of paths) {
    const res = await apiFetch(path);
    lastStatus = res.status;
    if (res.ok) {
      const data = await jsonOrThrow(res);
      return unwrapArray(data);
    }
    if (res.status !== 404) return await jsonOrThrow(res);
  }
  throw Object.assign(new Error(`[HTTP ${lastStatus}] مسار تقييمات المحامي غير متاح.`), {
    status: lastStatus,
  });
}

/**
 * إرسال تقييم بعد اكتمال طلب — Swagger: POST /api/mini/reviews (CreateReviewDto)
 */
export async function miniPostReview(payload) {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 250));
    return { id: 0, rating: /** @type {any} */ (payload)?.rating };
  }
  const usePascal =
    String(import.meta.env.VITE_MINI_REVIEW_BODY || '').toLowerCase() === 'pascal';
  const p = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
  const cid = p.consultationRequestId ?? p.ConsultationRequestId;
  const rating = p.rating ?? p.Rating;
  const comment = p.comment ?? p.Comment ?? '';
  const body = usePascal
    ? {
        ConsultationRequestId: Number(cid),
        Rating: Math.trunc(Number(rating) || 0),
        Comment: String(comment),
      }
    : {
        consultationRequestId: Math.trunc(Number(cid) || 0),
        rating: Math.trunc(Number(rating) || 0),
        comment: String(comment),
      };
  const paths = ['/api/mini/reviews/', '/api/mini/reviews'];
  let lastStatus = 404;
  for (const path of paths) {
    const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
    lastStatus = res.status;
    if (res.ok) return await jsonOrThrow(res);
    if (res.status !== 404) return await jsonOrThrow(res);
  }
  throw Object.assign(new Error(`[HTTP ${lastStatus}] مسار إرسال التقييم غير متاح.`), {
    status: lastStatus,
  });
}

/**
 * مساعد AI المصغّر — POST /api/mini/ai-chat (JWT مطلوب)
 * Swagger: AiChatRequestDto { message } → AiChatResponseDto { reply, suggestedServiceType?, suggestedAction? }
 * @param {{ message: string }} payload
 * @returns {Promise<{ reply: string; suggestedServiceType: string; suggestedAction: string }>}
 */
export async function miniAiChat(payload) {
  const rawMsg = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (!rawMsg) {
    throw Object.assign(new Error('الرسالة فارغة'), { code: 'VALIDATION' });
  }
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 650));
    return {
      reply:
        'رد تجريبي محلي (بدون باكند): عند ضبط VITE_API_BASE_URL سيُستدعى POST /api/mini/ai-chat بالرسالة الفعلية.',
      suggestedServiceType: '',
      suggestedAction: '',
    };
  }
  const usePascal =
    String(import.meta.env.VITE_MINI_AI_CHAT_BODY || '').toLowerCase() === 'pascal';
  const body = usePascal ? { Message: rawMsg } : { message: rawMsg };
  const paths = ['/api/mini/ai-chat/', '/api/mini/ai-chat'];
  let lastStatus = 404;
  for (const path of paths) {
    const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
    lastStatus = res.status;
    if (res.ok) {
      const raw = await jsonOrThrow(res);
      return normalizeMiniAiChatResponse(raw);
    }
    if (res.status !== 404) return await jsonOrThrow(res);
  }
  throw Object.assign(new Error(`[HTTP ${lastStatus}] مسار المساعد AI غير موجود على الخادم.`), {
    status: lastStatus,
  });
}

/** @param {unknown} raw */
function normalizeMiniAiChatResponse(raw) {
  if (!raw || typeof raw !== 'object') {
    return { reply: '', suggestedServiceType: '', suggestedAction: '' };
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const reply = pickProp(o, 'reply', 'Reply');
  const st = pickProp(o, 'suggestedServiceType', 'SuggestedServiceType');
  const act = pickProp(o, 'suggestedAction', 'SuggestedAction');
  return {
    reply: reply != null ? String(reply).trim() : '',
    suggestedServiceType: st != null ? String(st).trim() : '',
    suggestedAction: act != null ? String(act).trim() : '',
  };
}

/**
 * المحامي المُعيَّن: GET اختياري (مثلاً /api/mini/me/assigned-lawyer) ثم احتياطي من أحدث طلب فيه assignedLawyer (RequestDto).
 */
export async function miniGetMyAssignedLawyer() {
  if (useLocalMiniMock()) return null;
  const path =
    (typeof import.meta.env.VITE_MINI_ASSIGNED_LAWYER_PATH === 'string' &&
      import.meta.env.VITE_MINI_ASSIGNED_LAWYER_PATH.trim()) ||
    '/api/mini/me/assigned-lawyer';
  try {
    const res = await apiFetch(path);
    if (res.ok) return await jsonOrThrow(res);
  } catch {
    /* جرّب الطلبات */
  }
  try {
    const reqs = await miniGetMyRequests();
    const list = Array.isArray(reqs) ? reqs : [];
    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const row = /** @type {Record<string, unknown>} */ (r);
      const al = row.assignedLawyer ?? row.AssignedLawyer;
      if (al && typeof al === 'object' && !Array.isArray(al)) {
        const L = /** @type {Record<string, unknown>} */ (al);
        const name = (L.fullName ?? L.FullName ?? '').toString().trim();
        if (name) return { lawyer: al };
      }
    }
  } catch {
    /* */
  }
  return null;
}

export async function miniGetMyContracts() {
  if (useLocalMiniMock()) return [];
  const res = await apiFetch('/api/mini/contracts/my');
  const data = await jsonOrThrow(res);
  return unwrapArray(data).map((row) => normalizeMiniContractInstance(row));
}

export async function miniGetContractById(id) {
  const res = await apiFetch(`/api/mini/contracts/${encodeURIComponent(String(id))}`);
  const raw = await jsonOrThrow(res);
  return normalizeMiniContractInstance(raw);
}

export async function miniGetContractTemplates() {
  if (useLocalMiniMock()) return [];
  const res = await apiFetch('/api/mini/contracts/templates');
  const data = await jsonOrThrow(res);
  return unwrapArray(data).map((row) => normalizeMiniContractTemplate(row));
}

/** تفاصيل قالب + الحقول المطلوبة — Swagger: GET /api/mini/contracts/templates/{id} */
export async function miniGetContractTemplateById(id) {
  const res = await apiFetch(`/api/mini/contracts/templates/${encodeURIComponent(String(id))}`);
  const raw = await jsonOrThrow(res);
  const inner = unwrapTemplateDetailPayload(raw);
  return normalizeMiniContractTemplate(inner);
}

/** قيم افتراضية وحقل `data` قبل التوليد — Swagger: GET /api/mini/contracts/templates/{id}/ready-data */
export async function miniGetContractTemplateReadyData(id) {
  const res = await apiFetch(
    `/api/mini/contracts/templates/${encodeURIComponent(String(id))}/ready-data`,
  );
  const raw = await jsonOrThrow(res);
  return normalizeMiniTemplateReadyData(raw);
}

/** معرّف دفعة من رد POST .../payments/simulate — يُربط غالباً بتوليد العقد على الباكند. */
export function pickSimulatedPaymentId(payRes) {
  if (!payRes || typeof payRes !== 'object') return undefined;
  const o = /** @type {Record<string, unknown>} */ (payRes);
  const v = o.id ?? o.Id ?? o.paymentId ?? o.PaymentId;
  if (v == null || v === '') return undefined;
  return v;
}

/**
 * LegalTech GenerateContractDto: كل قيم `data` يجب أن تكون string (Swagger additionalProperties string).
 */
function stringifyGenerateContractData(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = '';
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

export async function miniGenerateContract(payload) {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 400));
    const tid =
      payload && typeof payload === 'object'
        ? /** @type {any} */ (payload).templateId ?? /** @type {any} */ (payload).TemplateId ?? 'demo'
        : 'demo';
    return normalizeMiniContractInstance({
      id: `local-contract-${Date.now()}`,
      contractId: `local-contract-${Date.now()}`,
      title: 'عقد تجريبي (واجهة فقط)',
      templateId: tid,
      status: 'Draft',
    });
  }
  const usePascal =
    String(import.meta.env.VITE_MINI_CONTRACT_GENERATE_BODY || '').toLowerCase() === 'pascal';
  const p = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
  const rawData = p.data ?? p.Data;
  const dataObj =
    rawData != null && typeof rawData === 'object' && !Array.isArray(rawData)
      ? stringifyGenerateContractData(/** @type {Record<string, unknown>} */ (rawData))
      : rawData;
  const tidRaw = p.templateId ?? p.TemplateId;
  const tidNum = Number(tidRaw);
  const tid = Number.isFinite(tidNum) ? Math.trunc(tidNum) : tidRaw;
  const body = /** @type {Record<string, unknown>} */ (
    usePascal ? { TemplateId: tid, Data: dataObj } : { templateId: tid, data: dataObj }
  );

  const payId = p.paymentId ?? p.PaymentId ?? p.miniPaymentId ?? p.MiniPaymentId;
  const consultId = p.consultationRequestId ?? p.ConsultationRequestId;
  const genContractId = p.generatedContractId ?? p.GeneratedContractId;
  const linkField =
    typeof import.meta.env.VITE_MINI_CONTRACT_GENERATE_LINK_FIELD === 'string'
      ? import.meta.env.VITE_MINI_CONTRACT_GENERATE_LINK_FIELD.trim()
      : '';
  /** Swagger GenerateContractDto المنشور: templateId + data فقط؛ الحقول الإضافية تتطلب تفعيل صريح */
  const allowGenerateExtras =
    import.meta.env.VITE_MINI_CONTRACT_GENERATE_EXTRA_FIELDS === 'true';

  function setBodyField(camelKey, pascalKey, val) {
    if (val == null || val === '') return;
    if (usePascal) body[pascalKey] = val;
    else body[camelKey] = val;
  }

  if (allowGenerateExtras) {
    if (linkField && payId != null && payId !== '') {
      body[linkField] = payId;
    } else if (payId != null && payId !== '') {
      setBodyField('paymentId', 'PaymentId', payId);
    }
    setBodyField('consultationRequestId', 'ConsultationRequestId', consultId);
    setBodyField('generatedContractId', 'GeneratedContractId', genContractId);
  }

  const res = await apiFetch('/api/mini/contracts/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const raw = await jsonOrThrow(res);
  return normalizeMiniContractInstance(raw);
}

export async function miniSendContractForSigning(id, payload) {
  const usePascal =
    String(import.meta.env.VITE_MINI_CONTRACT_GENERATE_BODY || '').toLowerCase() === 'pascal';
  const body =
    usePascal && payload && typeof payload === 'object'
      ? {
          SecondPartyName:
            /** @type {any} */ (payload).secondPartyName ?? /** @type {any} */ (payload).SecondPartyName,
          SecondPartyPhone:
            /** @type {any} */ (payload).secondPartyPhone ?? /** @type {any} */ (payload).SecondPartyPhone,
        }
      : payload;
  const res = await apiFetch(
    `/api/mini/contracts/${encodeURIComponent(String(id))}/send-for-signing`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  const raw = await jsonOrThrow(res);
  const n = normalizeMiniContractInstance(raw);
  return n && typeof n === 'object' ? n : raw;
}

/**
 * الملف الحالي: GET /api/mini/auth/profile (Swagger) ثم احتياطي /api/mini/me.
 */
export async function miniGetCurrentUser() {
  if (useLocalMiniMock()) {
    await new Promise((r) => setTimeout(r, 120));
    return {
      userId: 'local-user',
      email: 'demo@local.test',
      fullName: 'مستخدم تجريبي',
      role: 'User',
    };
  }
  const profilePath =
    (typeof import.meta.env.VITE_MINI_PROFILE_PATH === 'string' &&
      import.meta.env.VITE_MINI_PROFILE_PATH.trim()) ||
    '/api/mini/auth/profile';
  const r1 = await apiFetch(profilePath);
  if (r1.ok) return jsonOrThrow(r1);
  const r2 = await apiFetch('/api/mini/me');
  return jsonOrThrow(r2);
}
