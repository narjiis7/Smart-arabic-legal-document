/**
 * عرض قوائم العقود بما يتوافق مع Swagger:
 * GET /api/mini/contracts/my — id, templateName, fileUrl, status, qrToken, expiryDate,
 * isSignedByOwner, isSignedBySecondParty, secondPartyName, secondPartyPhone, createdAt
 */

/**
 * @param {unknown} dt
 * @param {'short' | 'long'} mode
 */
export function formatContractDate(dt, mode = 'short') {
  if (!dt) return '-';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '-';
  if (mode === 'long') {
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function mapTone(status, signed) {
  const st = status != null ? String(status) : '';
  if (signed) return 'green';
  if (/cancel/i.test(st) || /expir/i.test(st) || st === 'ملغى') return 'red';
  return 'blue';
}

/** وقت انتهاء الصلاحية بالميلي ثانية أو null */
function expiryToMs(raw) {
  if (raw == null || raw === '') return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * هل يُعرض العقد في أرشيف «عقودي»؟ موقّع بالكامل، أو منتهي التاريخ، أو حالة إلغاء/إنهاء من الـ API.
 * @param {{ signed?: boolean, apiStatus?: string, expiryAtMs?: number | null | undefined }} row
 */
export function isContractArchivedForUi(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.signed) return true;
  const st = (row.apiStatus != null ? String(row.apiStatus) : '').toLowerCase();
  if (
    /cancel|cancelled|canceled|expired|expir|reject|rejected|void|revoked|terminated|completed|closed|declined|ملغى|منته|مرفوض/.test(
      st,
    )
  ) {
    return true;
  }
  const t = row.expiryAtMs;
  if (typeof t === 'number' && Number.isFinite(t) && t < Date.now()) return true;
  return false;
}

/**
 * صف عقد بعد التطبيع من api (normalizeMiniContractInstance).
 * @param {Record<string, unknown>} c
 */
export function mapSwaggerContractToListRow(c) {
  if (!c || typeof c !== 'object') {
    return {
      id: null,
      title: 'عقد',
      endDate: '-',
      status: '—',
      tone: 'blue',
      signed: false,
      issueDate: '-',
      fileUrl: '',
      apiStatus: '',
      expiryAtMs: null,
    };
  }
  const signed = Boolean(c.isSignedByOwner && c.isSignedBySecondParty);
  const apiStatus = c.status != null ? String(c.status) : '';
  const expiryAtMs = expiryToMs(c.expiryDate ?? c.ExpiryDate);
  return {
    id: c.id,
    title: (c.templateName != null && String(c.templateName).trim()) || 'عقد',
    endDate: c.expiryDate ? formatContractDate(c.expiryDate, 'short') : '-',
    status: signed ? 'موقّع' : apiStatus || 'نشط',
    tone: mapTone(apiStatus, signed),
    signed,
    issueDate: formatContractDate(c.createdAt, 'short'),
    fileUrl: typeof c.fileUrl === 'string' ? c.fileUrl : '',
    apiStatus,
    qrToken: typeof c.qrToken === 'string' ? c.qrToken : '',
    expiryAtMs,
  };
}

/**
 * لبطاقة «طلباتي» حيث يُفضَّل إظهار حالة الـ API كنص (مثل Draft) مع ألوان بسيطة.
 * @param {Record<string, unknown>} c
 */
export function mapSwaggerContractToRequestCard(c) {
  const row = mapSwaggerContractToListRow(c);
  const signed = row.signed;
  return {
    ...row,
    statusColor: signed ? '#27ae60' : '#2E86C1',
    cardStatus: row.apiStatus || (signed ? 'موقّع' : 'نشط'),
  };
}
