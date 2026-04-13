<script>
  import { onMount } from 'svelte';
  import { apiFetch, getApiBase, miniGetContractById, miniSendContractForSigning } from '../api.js';
  import {
    humanizeFieldKey,
    loadDemoSnapshotIfIdMatches,
  } from '../contractClientDemo.js';

  export let onBack = () => {};
  export let contract = {
    id: null,
    title: '',
    status: '',
    issueDate: '',
    endDate: '',
    signed: false,
  };

  let actionMsg = '';
  let loading = true;
  let full = /** @type {Record<string, any> | null} */ (null);
  let secondPartyName = '';
  let secondPartyPhone = '';
  /** بعد نجاح send-for-signing — مطابق Swagger: signingToken → origin/signing/token */
  let lastSigningUrl = '';
  /** لقطة حقول من التوليد (محفوظة في المتصفح — localStorage مع احتياط sessionStorage) */
  let fieldSnapshot = /** @type {null | { templateName?: string; data?: Record<string, unknown> }} */ (
    null
  );

  function contractPayloadRoot(obj) {
    if (!obj || typeof obj !== 'object') return null;
    return obj.data ?? obj.Data ?? obj.result ?? obj.Result ?? obj;
  }

  /** حقول شائعة في رد GET عقد / PDF من الباكند (.NET قد يستخدم PascalCase). */
  function pickPdfUrl(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
      obj.pdfUrl,
      obj.PdfUrl,
      obj.downloadUrl,
      obj.DownloadUrl,
      obj.fileUrl,
      obj.FileUrl,
      obj.documentUrl,
      obj.DocumentUrl,
      obj.pdfDownloadUrl,
      obj.PdfDownloadUrl,
      obj.attachmentUrl,
      obj.AttachmentUrl,
      obj.generatedPdfUrl,
      obj.signedPdfUrl,
      obj.publicUrl,
      obj.url,
      obj.Url,
      obj.pdf?.url,
      obj.file?.url,
      obj.document?.url,
    ];
    for (const u of candidates) {
      if (typeof u === 'string' && u.trim()) return u.trim();
    }
    return '';
  }


  function fmtDate(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return String(dt);
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /** حقول النموذج من رد GET إن رجعها الخادم تحت data/Data */
  function extractApiContractData(obj) {
    const root = contractPayloadRoot(obj) || obj;
    if (!root || typeof root !== 'object') return {};
    const d = root.data ?? root.Data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    return /** @type {Record<string, unknown>} */ (d);
  }

  function formatFieldDisplayValue(v) {
    if (v == null) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    const s = String(v).trim();
    return s || '—';
  }

  onMount(async () => {
    const id = contract?.id;
    fieldSnapshot = null;
    if (id == null || id === '') {
      full = null;
      loading = false;
      return;
    }
    try {
      full = await miniGetContractById(id);
      const root = contractPayloadRoot(full) || full || {};
      secondPartyName =
        (root &&
          (root.secondPartyName || root.SecondPartyName || root.second_party_name)) ||
        '';
      secondPartyPhone =
        (root &&
          (root.secondPartyPhone || root.SecondPartyPhone || root.second_party_phone)) ||
        '';
    } catch {
      full = null;
      secondPartyName = '';
      secondPartyPhone = '';
    }
    fieldSnapshot = loadDemoSnapshotIfIdMatches(id);
    loading = false;
  });

  function signingUrlFromApiResponse(res) {
    if (!res || typeof res !== 'object') return '';
    const token = res.signingToken ?? res.signing_token ?? res.SigningToken;
    if (token != null && String(token).trim() && typeof window !== 'undefined') {
      return `${window.location.origin}/signing/${encodeURIComponent(String(token).trim())}`;
    }
    if (typeof res.signingLink === 'string' && res.signingLink.trim()) return res.signingLink.trim();
    if (typeof res.signingUrl === 'string' && res.signingUrl.trim()) return res.signingUrl.trim();
    return '';
  }

  $: c = contractPayloadRoot(full) || full || {};
  $: snapFieldData =
    fieldSnapshot &&
    fieldSnapshot.data &&
    typeof fieldSnapshot.data === 'object' &&
    !Array.isArray(fieldSnapshot.data) &&
    Object.keys(fieldSnapshot.data).length > 0
      ? fieldSnapshot.data
      : null;
  $: apiFieldData = extractApiContractData(full);
  $: contractFieldMap =
    snapFieldData != null
      ? snapFieldData
      : apiFieldData && Object.keys(apiFieldData).length > 0
        ? apiFieldData
        : {};
  $: contractFieldRows = Object.entries(contractFieldMap).filter(
    ([k]) => k != null && String(k).trim() !== '',
  );
  $: usedLocalFieldSnapshot = snapFieldData != null;
  $: title =
    (fieldSnapshot?.templateName && String(fieldSnapshot.templateName).trim()) ||
    c.templateName ||
    c.TemplateName ||
    contract.title ||
    '—';
  $: statusLabel = c.status || c.Status || contract.status || '—';
  $: issueDate = fmtDate(c.createdAt || c.CreatedAt) || contract.issueDate || '—';
  $: endDate = fmtDate(c.expiryDate || c.ExpiryDate) || contract.endDate || '—';
  $: ownerSigned =
    typeof c.isSignedByOwner === 'boolean'
      ? c.isSignedByOwner
      : typeof c.IsSignedByOwner === 'boolean'
        ? c.IsSignedByOwner
        : undefined;
  $: secondSigned =
    typeof c.isSignedBySecondParty === 'boolean'
      ? c.isSignedBySecondParty
      : typeof c.IsSignedBySecondParty === 'boolean'
        ? c.IsSignedBySecondParty
        : undefined;
  $: signed =
    full != null && typeof ownerSigned === 'boolean' && typeof secondSigned === 'boolean'
      ? Boolean(ownerSigned && secondSigned)
      : Boolean(contract.signed);

  async function sendForSigning() {
    actionMsg = '';
    lastSigningUrl = '';
    const id = contract?.id;
    if (id == null) {
      actionMsg = 'لا يوجد معرّف عقد للإرسال.';
      return;
    }
    const name = (secondPartyName || '').trim();
    const phone = (secondPartyPhone || '').replace(/\s/g, '');
    if (!name || !phone) {
      actionMsg = 'أدخل اسم الطرف الثاني ورقم الهاتف.';
      return;
    }
    try {
      const res = await miniSendContractForSigning(id, {
        secondPartyName: name,
        secondPartyPhone: phone,
      });
      lastSigningUrl = signingUrlFromApiResponse(res);
      actionMsg = lastSigningUrl
        ? 'تم الإرسال. رابط التوقيع جاهز للطرف الثاني:'
        : 'تم إرسال طلب التوقيع.';
    } catch (e) {
      actionMsg =
        (e && typeof e.message === 'string' && e.message) || 'تعذر إرسال العقد للتوقيع.';
    }
  }

</script>

<div class="page">
  <div class="header">
    <div class="menu-dot">•••</div>
    <h1>تفاصيل العقد</h1>
    <button class="back-btn" on:click={onBack}>←</button>
  </div>

  <div class="content">
    {#if loading}
      <p class="load-hint">جاري تحميل تفاصيل العقد...</p>
    {/if}
    <div class="card hero-card">
      <div class="hero-icon">🏠</div>
      <h2>{title}</h2>
      <span class="status-pill">{statusLabel}</span>
    </div>

    {#if contractFieldRows.length > 0}
      <div class="card fields-card">
        <h3 class="fields-heading">تفاصيل الحقول</h3>
        {#if usedLocalFieldSnapshot}
          <p class="fields-note">
            البيانات المعروضة هي التي أدخلتها عند التوليد (محفوظة في هذا المتصفح لنفس معرّف العقد).
          </p>
        {:else}
          <p class="fields-note">من بيانات العقد القادمة من الخادم.</p>
        {/if}
        {#each contractFieldRows as [fKey, fVal], fi}
          <div class="detail-row">
            <div class="value field-value">{formatFieldDisplayValue(fVal)}</div>
            <div class="label">{humanizeFieldKey(fKey)}</div>
          </div>
          {#if fi < contractFieldRows.length - 1}
            <div class="divider"></div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="card details-card">
      <div class="detail-row">
        <div class="value">{issueDate}</div>
        <div class="label">تاريخ الإصدار</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value">{endDate}</div>
        <div class="label">تاريخ الانتهاء</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value">{c.secondPartyName || c.second_party_name || '—'}</div>
        <div class="label">الطرف الثاني</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value" dir="ltr">{c.secondPartyPhone || c.second_party_phone || '—'}</div>
        <div class="label">هاتف الطرف الثاني</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value signed">{c.isSignedByOwner ? '✓' : '—'}</div>
        <div class="label">توقيع المالك</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value signed">{c.isSignedBySecondParty ? '✓' : '—'}</div>
        <div class="label">توقيع الطرف الثاني</div>
      </div>
      <div class="divider"></div>
      <div class="detail-row">
        <div class="value signed">{signed ? '✓ مكتمل' : 'قيد الانتظار'}</div>
        <div class="label">الحالة</div>
      </div>
    </div>

    <div class="card signing-card">
      <div class="field-label">إرسال العقد للتوقيع</div>
      <label class="sr-only" for="sp-name">اسم الطرف الثاني</label>
      <input
        id="sp-name"
        class="signing-input"
        type="text"
        placeholder="اسم الطرف الثاني"
        bind:value={secondPartyName}
      />
      <label class="sr-only" for="sp-phone">هاتف الطرف الثاني</label>
      <input
        id="sp-phone"
        class="signing-input"
        type="tel"
        placeholder="07701234567"
        dir="ltr"
        bind:value={secondPartyPhone}
      />
    </div>

    <button class="cta outline" type="button" on:click={sendForSigning}>إرسال للتوقيع</button>
    {#if actionMsg}
      <div class="action-msg">{actionMsg}</div>
    {/if}
    {#if lastSigningUrl}
      <a class="signing-link" href={lastSigningUrl} target="_blank" rel="noopener noreferrer">
        فتح صفحة التوقيع
      </a>
    {/if}
  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>
</div>

<style>
  .page {
    min-height: 100vh;
    background: transparent;
    display: flex;
    flex-direction: column;
  }

  .header {
    margin: 12px 14px 0;
    padding: 14px 16px;
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }

  .back-btn,
  .menu-dot {
    color: #e8edf4;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 40px;
    height: 40px;
    font-size: 20px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .header h1 {
    text-align: center;
    color: #f8fafc;
    margin: 0;
    font-size: 24px;
    font-weight: 900;
  }

  .content {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .load-hint {
    text-align: center;
    color: rgba(232, 237, 244, 0.5);
    font-size: 14px;
    margin: 0;
  }

  .card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 16px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }

  .hero-card {
    text-align: center;
    padding: 26px 16px 20px;
  }

  .hero-icon {
    font-size: 52px;
    line-height: 1;
    margin-bottom: 14px;
  }

  .hero-card h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    color: #f1f5f9;
  }

  .status-pill {
    display: inline-block;
    margin-top: 10px;
    padding: 7px 14px;
    background: rgba(52, 211, 153, 0.18);
    color: #6ee7b7;
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 999px;
    font-size: 13px;
    font-weight: 800;
  }

  .details-card {
    padding: 14px 16px;
  }

  .fields-card {
    padding: 14px 16px;
  }
  .fields-heading {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 900;
    color: #e8edf4;
    text-align: right;
  }
  .fields-note {
    margin: 0 0 12px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(226, 232, 240, 0.55);
    text-align: right;
  }
  .field-value {
    text-align: left;
    max-width: 58%;
    word-break: break-word;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 4px;
  }

  .label {
    color: rgba(226, 232, 240, 0.45);
    font-weight: 700;
    font-size: 14px;
  }

  .value {
    color: #f1f5f9;
    font-weight: 900;
    font-size: 15px;
  }

  .value.signed {
    color: #6ee7b7;
  }

  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .cta {
    border: none;
    font-size: 16px;
    font-weight: 900;
    padding: 14px 16px;
    border-radius: 16px;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
  }

  .cta.outline {
    background: rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(125, 211, 252, 0.45);
    color: #7dd3fc;
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.08);
  }
  .back-step-btn {
    margin: 0 14px 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    color: #e8edf4;
    border-radius: 999px;
    padding: 12px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    width: calc(100% - 28px);
  }
  .action-msg {
    color: rgba(125, 211, 252, 0.95);
    font-size: 13px;
    text-align: center;
    line-height: 1.5;
  }
  .signing-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .field-label {
    font-size: 13px;
    font-weight: 800;
    color: rgba(226, 232, 240, 0.7);
  }
  .signing-input {
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(15, 23, 42, 0.4);
    color: #f1f5f9;
    border-radius: 14px;
    padding: 12px 14px;
    font-size: 15px;
    font-family: inherit;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .signing-link {
    display: block;
    text-align: center;
    color: #7dd3fc;
    font-weight: 800;
    font-size: 15px;
  }
</style>
