/**
 * تعيين محامٍ للمستخدم — تخزين محلي للواجهة والتجربة؛ يمكن للباكند لاحقاً
 * استبدال القراءة بـ GET /api/mini/me/assigned-lawyer مع نفس الشكل.
 */

import { decodeJwtPayload } from './auth.js';
import { getBearerToken } from './session.js';

const STORAGE_KEY = 'legal_app_lawyer_assignments_v1';

/** قائمة محامين جاهزة لاختيار الأدمن (يمكن لاحقاً جلبها من API) */
export const PRESET_LAWYERS = [
  {
    id: 'l1',
    fullName: 'د. أحمد الكرخي',
    specialty: 'قضايا مدنية وتجارية',
    ratingAvg: 4.8,
    reviewCount: 124,
    phone: '964770000001',
  },
  {
    id: 'l2',
    fullName: 'د. سارة الموسوي',
    specialty: 'عقود وشركات',
    ratingAvg: 4.9,
    reviewCount: 89,
    phone: '964770000002',
  },
  {
    id: 'l3',
    fullName: 'د. كريم نعمة',
    specialty: 'عمل وأجور',
    ratingAvg: 4.6,
    reviewCount: 56,
    phone: '964770000003',
  },
  {
    id: 'l4',
    fullName: 'د. زينب الراوي',
    specialty: 'أحوال شخصية',
    ratingAvg: 5,
    reviewCount: 203,
    phone: '964770000004',
  },
];

function safeParse(raw) {
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function readMap() {
  if (typeof localStorage === 'undefined') return {};
  return safeParse(localStorage.getItem(STORAGE_KEY) || '{}');
}

function writeMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** مفتاح مستخدم للتعيين: userId أو البريد */
export function getAssignmentUserKey() {
  if (typeof sessionStorage === 'undefined') return '';
  const uid = sessionStorage.getItem('userId')?.trim();
  if (uid) return `id:${uid}`;
  const em = sessionStorage.getItem('userEmail')?.trim().toLowerCase();
  if (em && em !== '—') return `email:${em}`;
  return '';
}

export function isAdminSession() {
  const dev = import.meta.env.VITE_DEV_ADMIN_LAWYER;
  if (dev === 'true' || dev === '1') return true;
  const r = (localStorage.getItem('role') || '').toLowerCase();
  if (r.includes('admin') || r.includes('administrator')) return true;
  const p = decodeJwtPayload(getBearerToken());
  const jr = String(
    p?.role ||
      p?.Role ||
      p?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      '',
  ).toLowerCase();
  return jr.includes('admin') || jr.includes('administrator');
}

/**
 * @param {string} userKey
 * @param {typeof PRESET_LAWYERS[0]} lawyer
 */
export function setLawyerAssignmentForUserKey(userKey, lawyer) {
  if (!userKey || !lawyer) return;
  const map = readMap();
  map[userKey] = {
    lawyerId: lawyer.id,
    fullName: lawyer.fullName,
    specialty: lawyer.specialty || '',
    ratingAvg: Number(lawyer.ratingAvg) || 0,
    reviewCount: Number(lawyer.reviewCount) || 0,
    phone: String(lawyer.phone || '').replace(/\s/g, ''),
    updatedAt: new Date().toISOString(),
  };
  writeMap(map);
}

/** @param {string} userKey */
export function getLawyerAssignmentForUserKey(userKey) {
  if (!userKey) return null;
  const v = readMap()[userKey];
  return v && typeof v === 'object' ? v : null;
}

export function getLawyerAssignmentForCurrentUser() {
  const k = getAssignmentUserKey();
  if (!k) return null;
  return getLawyerAssignmentForUserKey(k);
}

/** يوحّد شكل رد API مع التخزين المحلي */
export function normalizeAssignedLawyerPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const root =
    o.data && typeof o.data === 'object' && !Array.isArray(o.data)
      ? /** @type {Record<string, unknown>} */ (o.data)
      : o;
  const L =
    root.lawyer && typeof root.lawyer === 'object'
      ? /** @type {Record<string, unknown>} */ (root.lawyer)
      : root;
  const name =
    (L.fullName || L.name || L.displayName || root.fullName || root.name || '').toString().trim();
  if (!name) return null;
  const rating =
    Number(
      L.ratingAvg ??
        L.rating ??
        L.averageRating ??
        L.AverageRating ??
        root.ratingAvg ??
        root.rating,
    ) || 0;
  const reviewCount =
    Number(L.reviewCount ?? L.reviewsCount ?? L.totalReviews ?? L.TotalReviews ?? root.reviewCount) ||
    0;
  const specialty = (
    L.specialty ||
    L.title ||
    L.experience ||
    L.bio ||
    L.Bio ||
    root.specialty ||
    ''
  ).toString();
  const phone = (L.phone || L.mobile || L.whatsApp || root.phone || '')
    .toString()
    .replace(/\s/g, '');
  const lawyerId = (L.id || L.lawyerId || root.lawyerId || '').toString() || 'api';
  const lp = Number(L.lawyerProfileId ?? L.LawyerProfileId ?? root.lawyerProfileId);
  const lawyerProfileId =
    Number.isFinite(lp) && lp > 0 ? Math.trunc(lp) : undefined;
  return {
    lawyerId,
    lawyerProfileId,
    fullName: name,
    specialty,
    ratingAvg: Math.min(5, Math.max(0, rating)),
    reviewCount,
    phone,
    updatedAt: new Date().toISOString(),
    source: 'api',
  };
}
