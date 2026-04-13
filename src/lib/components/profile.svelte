<script>
  import { onMount } from 'svelte';
  import { isApiConfigured, miniGetCurrentUser, miniGetMyPayments } from '../api.js';
  import { decodeJwtPayload, logout as authLogout } from '../auth.js';
  import { isAdminSession } from '../assignedLawyer.js';
  import AppBottomNav from './appBottomNav.svelte';
  import { notificationUnread, refreshNotificationUnread } from '../notificationUnread.js';
  import { theme, setTheme } from '../theme.js';

  export let onBack = () => {};
  export let onGoHome = () => {};
  export let onGoMyLawyer = () => {};
  export let onGoAdminLawyerAssign = () => {};
  export let onGoRequests = () => {};
  export let onGoContracts = () => {};
  export let onGoServices = () => {};
  export let onGoNotifications = () => {};

  $: showAdminAssign = isAdminSession();

  let user = { fullName: '…', email: '…' };
  let profileLoading = true;

  /** @type {Record<string, unknown>[]} */
  let payments = [];
  let paymentsLoading = false;

  function pickPay(o, ...keys) {
    if (!o || typeof o !== 'object') return undefined;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    }
    return undefined;
  }

  function paymentRowTitle(p) {
    const cr = pickPay(p, 'consultationRequestId', 'ConsultationRequestId');
    const gc = pickPay(p, 'generatedContractId', 'GeneratedContractId');
    if (cr != null && cr !== '') return `طلب استشارة — مرجع ${cr}`;
    if (gc != null && gc !== '') return `عقد — مرجع ${gc}`;
    return 'دفعة';
  }

  onMount(async () => {
    profileLoading = true;
    try {
      const me = await miniGetCurrentUser();
      user = {
        fullName: me.fullName || me.name || me.displayName || '—',
        email: me.email || sessionStorage.getItem('userEmail') || '—',
      };
    } catch {
      const storedName = sessionStorage.getItem('userFullName');
      const p = decodeJwtPayload(
        localStorage.getItem('accessToken') || sessionStorage.getItem('token'),
      );
      user = {
        fullName:
          storedName ||
          p?.name ||
          p?.given_name ||
          p?.unique_name ||
          p?.preferred_username ||
          p?.sub ||
          'مستخدم',
        email: p?.email || sessionStorage.getItem('userEmail') || '—',
      };
    }
    profileLoading = false;
    void refreshNotificationUnread();

    if (isApiConfigured()) {
      paymentsLoading = true;
      try {
        payments = await miniGetMyPayments();
      } catch {
        payments = [];
      } finally {
        paymentsLoading = false;
      }
    }
  });

  async function logout() {
    await authLogout();
    onGoHome();
  }

  const menu = [
    { id: 'my-lawyer', icon: '⚖️', label: 'محاميي', action: onGoMyLawyer },
    { id: 'requests', icon: '📋', label: 'طلباتي', action: onGoRequests },
    { id: 'contracts', icon: '📄', label: 'عقودي', action: onGoContracts },
    { id: 'alerts', icon: '🔔', label: 'الإشعارات', action: onGoNotifications }
  ];
</script>

<div class="page legal-surface">
  <div class="header">
    <div class="dot">•••</div>
    <h1>حسابي</h1>
    <button class="back-btn" type="button" on:click={onBack}>←</button>
  </div>

  <div class="content">
    <div class="profile-wrap">
      <div class="avatar">👤</div>
      {#if profileLoading}
        <h2>…</h2>
        <p>جاري التحميل</p>
      {:else}
        <h2>{user.fullName}</h2>
        <p>{user.email}</p>
      {/if}
    </div>

    {#if $notificationUnread > 0}
      <button type="button" class="notif-strip" on:click={onGoNotifications}>
        لديك <strong>{$notificationUnread}</strong> إشعار غير مقروء — عرض الكل
      </button>
    {/if}

    <div class="theme-row">
      <span>المظهر</span>
      <div class="theme-seg" role="group" aria-label="اختيار المظهر">
        <button
          type="button"
          class:active={$theme === 'light'}
          on:click={() => setTheme('light')}
        >
          نهاري
        </button>
        <button
          type="button"
          class:active={$theme === 'dark'}
          on:click={() => setTheme('dark')}
        >
          ليلي
        </button>
      </div>
    </div>

    {#if isApiConfigured()}
      <div class="payments-block">
        <h3 class="payments-heading">سجل المدفوعات</h3>
        {#if paymentsLoading}
          <p class="payments-hint">جاري التحميل…</p>
        {:else if payments.length === 0}
          <p class="payments-hint">لا توجد مدفوعات مسجّلة بعد.</p>
        {:else}
          <ul class="payments-list">
            {#each payments as p}
              <li class="payments-row">
                <div class="payments-row-main">
                  <span class="payments-title">{paymentRowTitle(p)}</span>
                  <span class="payments-amount" dir="ltr"
                    >{Number(pickPay(p, 'amount', 'Amount') ?? 0).toLocaleString('ar-IQ')} د.ع</span
                  >
                </div>
                <div class="payments-meta">
                  <span>{pickPay(p, 'status', 'Status') ?? '—'}</span>
                  <span class="payments-dot">·</span>
                  <span>{pickPay(p, 'method', 'Method') ?? '—'}</span>
                  {#if pickPay(p, 'createdAt', 'CreatedAt')}
                    <span class="payments-dot">·</span>
                    <span dir="ltr">{String(pickPay(p, 'createdAt', 'CreatedAt')).slice(0, 10)}</span>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}

    <div class="menu-card">
      {#each menu as item, i}
        <button
          class="menu-row"
          type="button"
          on:click={() => item.action && item.action()}
        >
          <span class="arrow">←</span>
          <div class="menu-title">{item.label}</div>
          <span class="menu-icon">{item.icon}</span>
        </button>
        {#if i < menu.length - 1}
          <div class="divider"></div>
        {/if}
      {/each}
    </div>

    {#if showAdminAssign}
      <button type="button" class="admin-assign-btn" on:click={onGoAdminLawyerAssign}>
        تعيين محامٍ للمستخدم (إدارة)
      </button>
    {/if}

    <button class="logout" type="button" on:click={logout}>تسجيل الخروج</button>
  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    active="profile"
    onNavHome={onGoHome}
    onNavServices={onGoServices}
    onNavContracts={onGoContracts}
    onNavNotifications={onGoNotifications}
    onNavProfile={() => {}}
  />
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
    padding: 14px 12px;
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
  .dot {
    color: rgba(232, 237, 244, 0.45);
    font-size: 20px;
    text-align: center;
  }
  .back-btn {
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
  .header h1 {
    margin: 0;
    text-align: center;
    color: #f8fafc;
    font-size: 24px;
    font-weight: 900;
  }
  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .profile-wrap {
    text-align: center;
    padding: 16px 0 4px;
  }
  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    display: grid;
    place-items: center;
    font-size: 30px;
    margin: 0 auto 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 28px rgba(34, 211, 238, 0.12);
  }
  .profile-wrap h2 {
    margin: 0 0 4px;
    font-size: 30px;
    color: #f8fafc;
    font-weight: 900;
  }
  .profile-wrap p {
    margin: 0;
    color: rgba(226, 232, 240, 0.6);
    font-size: 14px;
  }
  .notif-strip {
    width: 100%;
    box-sizing: border-box;
    border: none;
    border-radius: 999px;
    padding: 12px 14px;
    background: rgba(148, 163, 184, 0.3);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.28);
    color: #0f172a;
    font-size: 14px;
    font-family: inherit;
    font-weight: 800;
    text-align: center;
    cursor: pointer;
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
  .notif-strip strong {
    font-weight: 900;
  }
  .theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .theme-row > span:first-child {
    font-size: 15px;
    font-weight: 800;
    color: #e8edf4;
  }
  .theme-seg {
    display: flex;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
  .theme-seg button {
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: rgba(232, 237, 244, 0.65);
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .theme-seg button.active {
    background: rgba(251, 191, 36, 0.22);
    color: #fde68a;
  }
  .menu-card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 20px;
    padding: 6px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .menu-row {
    width: 100%;
    border: none;
    background: transparent;
    padding: 13px 4px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: inherit;
    cursor: pointer;
  }
  .menu-row:disabled {
    opacity: 0.9;
    cursor: default;
  }
  .menu-title {
    flex: 1;
    text-align: right;
    font-size: 15px;
    color: #e8edf4;
  }
  .menu-icon {
    font-size: 20px;
  }
  .arrow {
    color: rgba(251, 191, 36, 0.9);
    font-size: 18px;
  }
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
  .admin-assign-btn {
    width: 100%;
    margin-top: 4px;
    padding: 12px;
    border-radius: 16px;
    border: 1px dashed rgba(251, 191, 36, 0.45);
    background: rgba(251, 191, 36, 0.08);
    color: #fde68a;
    font-size: 14px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
  }
  .logout {
    margin-top: 2px;
    width: 100%;
    border: 1px solid rgba(248, 113, 113, 0.45);
    color: #fecaca;
    background: rgba(248, 113, 113, 0.08);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    border-radius: 999px;
    padding: 12px;
    font-size: 16px;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
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
