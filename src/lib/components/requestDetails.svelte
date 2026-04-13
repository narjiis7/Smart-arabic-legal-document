<script>
  import { onMount } from 'svelte';
  import { isApiConfigured, miniCancelRequest, miniGetRequestById, useMockAuth } from '../api.js';

  export let onBack = () => {};
  /** من قائمة الطلبات: يحتوي على id على الأقل */
  export let request = {
    id: null,
    title: '',
    status: '',
    description: '',
    assignedLawyer: null,
  };

  let loading = true;
  let loadError = '';
  let detail = /** @type {Record<string, any> | null} */ (null);
  let cancelling = false;
  let cancelMsg = '';
  const MOCK = useMockAuth();

  function statusAr(s) {
    const m = {
      Pending: 'قيد المراجعة',
      Assigned: 'مُسند لمحامٍ',
      Completed: 'مكتمل',
      Cancelled: 'ملغى',
    };
    return m[s] || s || '—';
  }

  function lawyerFrom(d) {
    const L = d?.assignedLawyer || d?.lawyer;
    if (!L) return { name: 'لم يُعيَّن بعد', subtitle: 'سيتم التعيين من لوحة الأدمن', phone: '' };
    const name = L.fullName || L.name || L.displayName || 'محامٍ';
    const subtitle = L.specialty || L.title || L.experience || L.bio || '';
    const phone = (L.whatsApp || L.phone || L.mobile || '').replace(/\s/g, '');
    return { name, subtitle, phone };
  }

  function buildTimeline(d) {
    const steps = d?.timeline;
    if (Array.isArray(steps) && steps.length)
      return steps.map((s) => ({
        title: s.title || s.step || s.name || '—',
        date: s.date || s.at || '',
        done: Boolean(s.done ?? s.completed),
      }));
    const st = d?.status || request.status;
    return [
      { title: 'استُلم الطلب', date: '', done: true },
      { title: 'تعيين محامٍ', date: '', done: st === 'Assigned' || st === 'Completed' },
      { title: 'اكتمال المتابعة', date: '', done: st === 'Completed' },
    ];
  }

  onMount(async () => {
    const id = request?.id;
    if (id == null || id === '') {
      detail = {
        serviceType: request.title,
        status: request.status,
        description: request.description,
        assignedLawyer: request.assignedLawyer,
      };
      loading = false;
      return;
    }
    loading = true;
    loadError = '';
    try {
      detail = await miniGetRequestById(id);
    } catch {
      loadError = 'تعذر تحميل تفاصيل الطلب من السيرفر.';
      detail = {
        serviceType: request.title,
        status: request.status,
        description: request.description,
        assignedLawyer: request.assignedLawyer,
      };
    }
    loading = false;
  });

  async function cancelPending() {
    const id = request?.id ?? detail?.id;
    const st = (detail?.status || request?.status || '').toString();
    if (id == null || id === '') return;
    if (st !== 'Pending') return;
    if (!MOCK && !isApiConfigured()) {
      cancelMsg = 'اضبط VITE_API_BASE_URL لإلغاء الطلب عبر السيرفر.';
      return;
    }
    cancelling = true;
    cancelMsg = '';
    try {
      const updated = await miniCancelRequest(id);
      detail = { ...detail, ...updated, status: updated?.status || 'Cancelled' };
    } catch (e) {
      cancelMsg =
        (e && typeof e.message === 'string' && e.message.trim()) || 'تعذّر إلغاء الطلب.';
    }
    cancelling = false;
  }

  $: d = detail || {};
  $: title = d.serviceType || request.title || 'طلب قانوني';
  $: statusLabel = statusAr(d.status || request.status);
  $: description = d.description || request.description || '—';
  $: lawyer = lawyerFrom(d);
  $: timeline = buildTimeline(d);
  $: waHref = lawyer.phone ? `https://wa.me/${lawyer.phone.replace(/^\+/, '')}` : '';
  $: canCancel =
    (d.status || request.status) === 'Pending' && (request?.id != null || d?.id != null);
</script>

<div class="page">
  <div class="header">
    <button class="back-btn" type="button" on:click={onBack}>←</button>
    <h1>تفاصيل الطلب</h1>
    <div class="menu-dot">•••</div>
  </div>

  <div class="content">
    {#if loading}
      <p class="hint">جاري التحميل...</p>
    {:else}
      {#if loadError}
        <p class="warn">{loadError}</p>
      {/if}
      <div class="case-card">
        <div class="card-top">
          <span class="badge">{statusLabel}</span>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </div>

      <h3 class="section-title">المحامي المُعيَّن</h3>
      <div class="lawyer-card">
        <div class="lawyer-avatar">⚖️</div>
        <div class="lawyer-info">
          <h4>{lawyer.name}</h4>
          {#if lawyer.subtitle}
            <p>{lawyer.subtitle}</p>
          {/if}
        </div>
      </div>

      <div class="timeline-card">
        {#each timeline as step}
          <div class="timeline-row">
            <div class="row-text">
              <div class="row-title">{step.title}</div>
              {#if step.date}
                <div class="row-date">{step.date}</div>
              {/if}
            </div>
            <span class="dot {step.done ? 'done' : 'pending'}"></span>
          </div>
        {/each}
      </div>

      {#if cancelMsg}
        <p class="warn">{cancelMsg}</p>
      {/if}
      {#if canCancel}
        <button
          class="cta danger"
          type="button"
          disabled={cancelling}
          on:click={cancelPending}
        >
          {cancelling ? 'جاري الإلغاء…' : 'إلغاء الطلب (قيد المراجعة فقط)'}
        </button>
      {/if}
      {#if waHref}
        <a class="cta" href={waHref} target="_blank" rel="noopener noreferrer">تواصل عبر واتساب ←</a>
      {:else}
        <button class="cta muted" type="button" disabled>تواصل عبر واتساب (يُعرض بعد التعيين)</button>
      {/if}
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
    font-size: 22px;
    font-weight: 900;
  }

  .content {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  .hint {
    text-align: center;
    color: rgba(232, 237, 244, 0.5);
    margin: 24px 0;
  }
  .warn {
    background: rgba(251, 191, 36, 0.12);
    border: 1px solid rgba(251, 191, 36, 0.35);
    color: #fde68a;
    padding: 12px;
    border-radius: 14px;
    font-size: 14px;
    margin: 0;
  }

  .case-card,
  .lawyer-card,
  .timeline-card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 14px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .card-top h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    color: #f1f5f9;
  }

  .badge {
    background: rgba(56, 189, 248, 0.2);
    color: #7dd3fc;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .case-card p {
    margin: 0;
    color: rgba(226, 232, 240, 0.55);
    font-size: 14px;
  }

  .section-title {
    margin: 4px 2px 0;
    font-size: 18px;
    color: #e8edf4;
  }

  .lawyer-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .lawyer-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e8edf4;
    display: grid;
    place-items: center;
    font-size: 22px;
  }

  .lawyer-info h4 {
    margin: 0;
    font-size: 17px;
    color: #f1f5f9;
  }

  .lawyer-info p {
    margin: 4px 0;
    color: rgba(226, 232, 240, 0.5);
    font-size: 13px;
  }

  .timeline-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
  }

  .row-title {
    font-size: 16px;
    font-weight: 800;
    color: #e8edf4;
  }

  .row-date {
    color: rgba(226, 232, 240, 0.45);
    font-size: 12px;
    margin-top: 2px;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .dot.done {
    background: #34d399;
    box-shadow: 0 0 10px rgba(52, 211, 153, 0.45);
  }

  .dot.pending {
    background: rgba(226, 232, 240, 0.2);
  }

  .cta {
    margin-top: auto;
    border: none;
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.35), rgba(249, 115, 22, 0.25));
    border: 1px solid rgba(251, 191, 36, 0.45);
    color: #fff8f0;
    font-size: 16px;
    font-weight: 800;
    padding: 14px;
    border-radius: 999px;
    font-family: inherit;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
    display: block;
    box-shadow: 0 8px 28px rgba(249, 115, 22, 0.18);
  }
  .cta.muted {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(226, 232, 240, 0.45);
    cursor: not-allowed;
    box-shadow: none;
  }
  .cta.danger {
    background: rgba(220, 38, 38, 0.85);
    border: 1px solid rgba(248, 113, 113, 0.5);
    color: #fff;
    box-shadow: 0 8px 24px rgba(220, 38, 38, 0.25);
  }
  .cta.danger:disabled {
    opacity: 0.75;
    cursor: wait;
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
</style>
