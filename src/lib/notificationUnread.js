import { writable } from 'svelte/store';
import { isApiConfigured, miniGetMyNotificationsBundle, useMockAuth } from './api.js';
import { hasAuthToken } from './session.js';

/** عدد الإشعارات غير المقروءة (من GET /api/mini/notifications/my → unreadCount) */
export const notificationUnread = writable(0);

export function setNotificationUnread(n) {
  const v = Math.max(0, Math.floor(Number(n)) || 0);
  notificationUnread.set(v);
}

export async function refreshNotificationUnread() {
  if (typeof window === 'undefined') return;
  if (!isApiConfigured() || useMockAuth() || !hasAuthToken()) {
    notificationUnread.set(0);
    return;
  }
  try {
    const { unreadCount } = await miniGetMyNotificationsBundle();
    notificationUnread.set(Math.max(0, Number(unreadCount) || 0));
  } catch {
    /* اترك القيمة الحالية */
  }
}
