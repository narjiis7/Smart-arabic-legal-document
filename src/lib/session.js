import { writable } from 'svelte/store';

/**
 * جلسة موحّدة لكل التطبيق: نفس التوكن يُقرأ من التخزين ويُعرَف به كل الصفحات.
 * - المصدر الأساسي: localStorage.accessToken
 * - نسخة متزامنة: sessionStorage.token (لتوافق الكود القديم وطلبات apiFetch)
 */

function readTokenRaw() {
  if (typeof localStorage === 'undefined') return '';
  const a = localStorage.getItem('accessToken');
  if (a != null && String(a).trim()) return String(a).trim();
  if (typeof sessionStorage === 'undefined') return '';
  const s = sessionStorage.getItem('token');
  return s != null && String(s).trim() ? String(s).trim() : '';
}

/** للاستخدام من api.js وغيره (بدون اشتراك Svelte). */
export function getBearerToken() {
  return readTokenRaw();
}

export function hasAuthToken() {
  return !!readTokenRaw();
}

/** حالة تسجيل الدخول لكل المكوّنات ($session.isLoggedIn). */
export const session = writable({
  isLoggedIn: false,
});

export function refreshSession() {
  session.set({ isLoggedIn: hasAuthToken() });
}

/**
 * مزامنة عند تغيّر التخزين (تبويب آخر) أو بعد دخول/خروج في نفس التبويب.
 * @returns {() => void} إزالة المستمع
 */
export function initSessionBridge() {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e) => {
    if (e.key === 'accessToken' || e.key === 'token' || e.key === null) refreshSession();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
