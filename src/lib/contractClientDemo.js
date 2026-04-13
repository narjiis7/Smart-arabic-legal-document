/**
 * لقطة حقول العقد في المتصفح — للعرض في «عقودي» / تفاصيل العقد / طباعة PDF احتياطية.
 * التخزين: localStorage (يبقى بعد إغلاق التبويب) + فهرس لقائمة «عقودي».
 * يُقرأ أيضاً من sessionStorage للتوافق مع الجلسات القديمة.
 */

import { formatContractDate } from './miniContractList.js';

const STORAGE_PREFIX = 'legal_app_contract_field_snapshot:';
const LOCAL_INDEX_KEY = 'legal_app_local_contracts_index';

function htmlEscape(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** تسمية عرض لمفتاح حقل (مشتركة مع شاشة تفاصيل العقد) */
export function humanizeFieldKey(key) {
  const s = String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(key);
}

/** تخطي POST /contracts/generate والاكتفاء بلقطة محلية + معرّف تجريبي */
export function useMiniContractClientDemo() {
  const v = import.meta.env.VITE_MINI_CONTRACT_CLIENT_DEMO;
  return v === 'true' || v === '1';
}

/**
 * @returns {{ id: string | number, templateName?: string, createdAt: number, status?: string }[]}
 */
export function loadLocalContractIndex() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_INDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && x.id != null && x.id !== '');
  } catch {
    return [];
  }
}

function saveLocalContractIndex(entries) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

/**
 * @param {{ id: string | number, templateName?: string, createdAt?: number, status?: string }} entry
 */
function upsertLocalContractIndex(entry) {
  const id = entry.id;
  if (id == null || id === '') return;
  const now = Date.now();
  const list = loadLocalContractIndex();
  const idx = list.findIndex((x) => String(x.id) === String(id));
  const prev = idx >= 0 ? list[idx] : null;
  const row = {
    id,
    templateName: (entry.templateName && String(entry.templateName).trim()) || prev?.templateName || 'عقد',
    createdAt: prev?.createdAt ?? entry.createdAt ?? now,
    status: entry.status || prev?.status || 'Draft',
  };
  if (idx >= 0) list[idx] = row;
  else list.unshift(row);
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  saveLocalContractIndex(list);
}

/**
 * صف قائمة «عقودي» من فهرس محلي (نفس شكل mapSwaggerContractToListRow تقريباً).
 * @param {{ id: string | number, templateName?: string, createdAt?: number, status?: string }} entry
 */
export function localIndexEntryToListRow(entry) {
  if (!entry || entry.id == null) return null;
  const st = entry.status != null ? String(entry.status) : 'Draft';
  const created = entry.createdAt ? new Date(entry.createdAt) : new Date();
  return {
    id: entry.id,
    title: (entry.templateName && String(entry.templateName).trim()) || 'عقد',
    endDate: '-',
    status: /draft|مسودة/i.test(st) ? 'مسودة' : st,
    tone: 'blue',
    signed: false,
    issueDate: formatContractDate(created, 'short'),
    fileUrl: '',
    apiStatus: st,
    qrToken: '',
    expiryAtMs: null,
  };
}

/**
 * دمج عقود السيرفر مع العقود المحفوظة محلياً (بدون فقدان عقود لم تُرجعها الـ API بعد).
 * @param {any[]} apiRows
 */
export function mergeContractListsWithLocal(apiRows) {
  const safeApi = Array.isArray(apiRows) ? apiRows : [];
  const localEntries = loadLocalContractIndex();
  const m = new Map();
  for (const e of localEntries) {
    const row = localIndexEntryToListRow(e);
    if (!row) continue;
    m.set(String(row.id), { ...row, _sortAt: e.createdAt || 0 });
  }
  for (const row of safeApi) {
    if (row?.id == null) continue;
    const k = String(row.id);
    const prev = m.get(k);
    const sortFromApi = row.issueDate ? 0 : 0;
    void sortFromApi;
    const merged = prev
      ? { ...prev, ...row, _sortAt: prev._sortAt || 0 }
      : { ...row, _sortAt: Number(row.id) && Number.isFinite(Number(row.id)) ? Number(row.id) : 0 };
    m.set(k, merged);
  }
  function fallbackSort(row) {
    const n = Number(row.id);
    return Number.isFinite(n) ? n : 0;
  }
  return Array.from(m.values())
    .sort((a, b) => (b._sortAt || fallbackSort(b)) - (a._sortAt || fallbackSort(a)))
    .map((row) => {
      const { _sortAt, ...rest } = row;
      return rest;
    });
}

function storageSetSnapshot(key, json) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, json);
      return true;
    } catch {
      /* fallthrough */
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(key, json);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function storageGetSnapshot(key) {
  if (typeof localStorage !== 'undefined') {
    try {
      const v = localStorage.getItem(key);
      if (v) return v;
    } catch {
      /* */
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {{ id: string, templateName?: string, templateId?: unknown, data?: Record<string, unknown> }} snapshot
 */
export function saveDemoContractSnapshot(snapshot) {
  if (!snapshot || snapshot.id == null || snapshot.id === '') return;
  const savedAt = Date.now();
  const payload = JSON.stringify({
    ...snapshot,
    id: String(snapshot.id),
    savedAt,
  });
  const key = STORAGE_PREFIX + String(snapshot.id);
  storageSetSnapshot(key, payload);
  upsertLocalContractIndex({
    id: snapshot.id,
    templateName: snapshot.templateName,
    createdAt: savedAt,
    status: 'Draft',
  });
}

/**
 * @param {string | number | null | undefined} contractId
 * @returns {null | { id: string, templateName?: string, templateId?: unknown, data?: Record<string, unknown>, savedAt?: number }}
 */
export function loadDemoSnapshotIfIdMatches(contractId) {
  if (contractId == null || contractId === '') return null;
  const key = STORAGE_PREFIX + String(contractId);
  try {
    let raw = storageGetSnapshot(key);
    if (!raw && typeof sessionStorage !== 'undefined') {
      try {
        raw = sessionStorage.getItem(key);
        if (raw && typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(key, raw);
          } catch {
            /* */
          }
        }
      } catch {
        /* */
      }
    }
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

/**
 * صفحة RTL للطباعة أو «حفظ كـ PDF» من نافذة الطباعة.
 * @returns {boolean} false إن حُظرت النافذة المنبثقة
 */
export function openDemoContractPrintable(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const data =
    snapshot.data && typeof snapshot.data === 'object' && !Array.isArray(snapshot.data)
      ? snapshot.data
      : {};
  const rows = Object.entries(data)
    .map(([k, v]) => {
      const label = humanizeFieldKey(k);
      const val = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `<tr><th style="text-align:right;padding:10px;border:1px solid #ddd;vertical-align:top;width:38%">${htmlEscape(label)}</th><td style="padding:10px;border:1px solid #ddd">${htmlEscape(val)}</td></tr>`;
    })
    .join('');
  const title = snapshot.templateName != null ? String(snapshot.templateName) : 'عقد';
  const idStr = snapshot.id != null ? String(snapshot.id) : '—';
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${htmlEscape(title)}</title>
<style>
body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#111;}
h1{font-size:1.35rem;margin:0 0 8px;}
.meta{color:#555;font-size:0.95rem;margin-bottom:20px;}
table{border-collapse:collapse;width:100%;}
.note{color:#666;margin-top:28px;font-size:0.9rem;line-height:1.5;}
.toolbar{margin-bottom:20px;}
button{font:inherit;padding:10px 18px;cursor:pointer;border:1px solid #333;border-radius:8px;background:#f5f5f5;}
</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button></div>
<h1>${htmlEscape(title)}</h1>
<div class="meta">نسخة من بيانات أدخلتها في التطبيق — ليست ملف PDF صادراً من الخادم. استخدم زر الطباعة ثم «Save as PDF» إن رغبت.</div>
<div class="meta">المعرّف: ${htmlEscape(idStr)}</div>
<table>${rows || '<tr><td colspan="2" style="padding:12px">لا توجد حقول مسجّلة.</td></tr>'}</table>
<p class="note">هذه الصفحة للعرض التجريبي والطباعة فقط ولا تحل محل مستند قانوني صادر من النظام بعد إصلاح الخادم.</p>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}
