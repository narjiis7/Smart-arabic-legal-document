<script>
  import { onMount } from 'svelte';
  import { miniGetMyRequests } from '../api.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  export let onNavHome = () => {};
  export let onNavServices = () => {};
  export let onNavContracts = () => {};
  export let onNavNotifications = () => {};
  export let onNavProfile = () => {};
  export let onOpenRequest = () => {};

  let requests = [];
  let loadError = '';

  function fmtDate(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function requestStatusColor(status) {
    if (status === 'Completed') return '#27ae60';
    if (status === 'Assigned') return '#F0A500';
    if (status === 'Cancelled') return '#c0392b';
    return '#2E86C1';
  }

  function statusAr(s) {
    const m = {
      Pending: 'قيد المراجعة',
      Assigned: 'مُسند لمحامٍ',
      Completed: 'مكتمل',
      Cancelled: 'ملغى',
    };
    return m[s] || s || '—';
  }

  function mapRequest(r) {
    const status = r.status || 'Pending';
    return {
      id: r.id,
      title: r.serviceType || 'طلب قانوني',
      status,
      statusLabelAr: statusAr(status),
      time: r.createdAt ? `قُدّم ${fmtDate(r.createdAt)}` : '-',
      statusColor: requestStatusColor(status),
      description: r.description || '-',
      assignedLawyer: r.assignedLawyer,
    };
  }

  onMount(async () => {
    loadError = '';
    try {
      const reqs = await miniGetMyRequests();
      requests = Array.isArray(reqs) ? reqs.map(mapRequest) : [];
    } catch (e) {
      const st = /** @type {{ status?: number }} */ (e).status;
      if (st === 401) {
        loadError =
          '٤٠١: انتهت الجلسة أو غير مسجّل دخول. ارجع للرئيسية وسجّل دخولاً ثم افتح الطلبات من جديد.';
      } else if (st === 403) {
        loadError = '٤٠٣: لا صلاحية لعرض الطلبات بهذا الحساب.';
      } else {
        loadError =
          (e && typeof e.message === 'string' && e.message.trim()) ||
          'تعذّر تحميل الطلبات. تحقق من تسجيل الدخول وعنوان الـ API.';
      }
      requests = [];
    }
  });

  /** طلبات نشطة (غير مكتملة وغير ملغاة) */
  $: activeRequests = requests.filter(
    (r) => r.status !== 'Completed' && r.status !== 'Cancelled',
  );
  /** أرشيف */
  $: pastRequests = requests.filter(
    (r) => r.status === 'Completed' || r.status === 'Cancelled',
  );

</script>

<div class="page legal-surface">

  <!-- الهيدر -->
  <div class="header">
    <div class="header-right">
      <span class="bell">🔔</span>
    </div>
    <h1>طلباتي</h1>
    <button class="header-back-btn" type="button" on:click={onBack}>←</button>
  </div>

  <div class="content">

    <!-- الترحيب -->
    <p class="greeting">👋 مرحباً</p>
    {#if loadError}
      <p class="fetch-err">{loadError}</p>
    {/if}

    <!-- الطلبات الحالية -->
    <div class="section">
      <h2 class="section-title">الطلبات الحالية</h2>
      {#if activeRequests.length === 0}
        <p class="empty-hint">لا توجد طلبات قيد المتابعة.</p>
      {:else}
        {#each activeRequests as req}
          <button type="button" class="card clickable" on:click={() => onOpenRequest(req)}>
            <div class="card-info">
              <p class="card-title">{req.title}</p>
              <p class="card-time">{req.time}</p>
              <p class="card-hint">اضغط لعرض التفاصيل</p>
            </div>
            <span class="badge" style="background:{req.statusColor}20; color:{req.statusColor}">
              {req.statusLabelAr}
            </span>
          </button>
        {/each}
      {/if}
    </div>

    <!-- الطلبات السابقة -->
    <div class="section">
      <h2 class="section-title">الطلبات السابقة</h2>
      {#if pastRequests.length === 0}
        <p class="empty-hint">لا يوجد أرشيف بعد.</p>
      {:else}
        {#each pastRequests as req}
          <button type="button" class="card clickable" on:click={() => onOpenRequest(req)}>
            <div class="card-info">
              <p class="card-title">{req.title}</p>
              <p class="card-time">{req.time}</p>
              <p class="card-hint">اضغط لعرض التفاصيل</p>
            </div>
            <span class="badge" style="background:{req.statusColor}20; color:{req.statusColor}">
              {req.statusLabelAr}
            </span>
          </button>
        {/each}
      {/if}
    </div>

  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    active="services"
    onNavHome={onNavHome}
    onNavServices={onNavServices}
    onNavContracts={onNavContracts}
    onNavNotifications={onNavNotifications}
    onNavProfile={onNavProfile}
  />

</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: transparent;
  }
  .header {
    margin: 12px 14px 0;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  .header h1 {
    color: #f8fafc;
    font-size: 18px;
    font-weight: 800;
  }
  .header-back-btn {
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #e8edf4;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: 18px;
    cursor: pointer;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .bell {
    font-size: 20px;
    background: rgba(255, 255, 255, 0.1);
    padding: 8px;
    border-radius: 14px;
    border: 1px solid rgba(251, 191, 36, 0.35);
    box-shadow: 0 0 18px rgba(251, 146, 60, 0.15);
  }
  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .greeting {
    font-size: 16px;
    font-weight: 700;
    color: #e8edf4;
  }
  .fetch-err {
    margin: 0;
    padding: 12px;
    border-radius: 14px;
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.35);
    color: #fecaca;
    font-size: 13px;
    line-height: 1.5;
  }
  .section { display: flex; flex-direction: column; gap: 10px; }
  .section-title {
    font-size: 18px;
    font-weight: 800;
    color: #e8edf4;
  }
  .empty-hint {
    margin: 0;
    padding: 12px 14px;
    font-size: 14px;
    color: rgba(232, 237, 244, 0.55);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    text-align: center;
  }
  .card {
    width: 100%;
    box-sizing: border-box;
    text-align: right;
    font-family: inherit;
    border: none;
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 18px;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .card.clickable { cursor: pointer; }
  .card-hint {
    margin: 6px 0 0;
    font-size: 11px;
    color: rgba(226, 232, 240, 0.45);
  }
  .card-title {
    font-size: 15px;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 4px;
  }
  .card-time { font-size: 12px; color: rgba(226, 232, 240, 0.5); }
  .badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
  }
  .back-step-btn {
    margin: 0 16px 10px;
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
    width: calc(100% - 32px);
  }
</style>