<script>
  import { onMount } from 'svelte';
  import {
    isApiConfigured,
    miniGetMyContracts,
    miniGetMyNotificationsBundle,
    miniGetMyRequests,
    miniMarkAllNotificationsRead,
    miniMarkNotificationRead,
    useMockAuth,
  } from '../api.js';
  import AppBottomNav from './appBottomNav.svelte';
  import { refreshNotificationUnread, setNotificationUnread } from '../notificationUnread.js';

  export let onBack = () => {};
  export let onGoHome = () => {};
  export let onGoServices = () => {};
  export let onGoContracts = () => {};
  export let onNavNotifications = () => {};
  export let onGoProfile = () => {};
  /** فتح تفاصيل طلب/عقد عند الضغط على إشعار مرتبط */
  export let onOpenRequest = /** @param {Record<string, unknown>} _r */ (_r) => {};
  export let onOpenContract = /** @param {Record<string, unknown>} _c */ (_c) => {};

  /** @type {Array<{ id: string | number; title: string; body: string; time: string; unread: boolean; sortAt: string | number; requestId?: unknown; contractId?: unknown; rawType?: unknown }>} */
  let notifications = [];
  let loadError = '';
  let loading = true;
  let markingAll = false;
  let opening = false;
  const MOCK = useMockAuth();

  function fmtDate(dt) {
    if (!dt) return '-';
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ar-IQ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function buildSyntheticFromRequestsContracts(requests, contracts) {
    const reqItems = (Array.isArray(requests) ? requests : []).map((r) => ({
      id: `r-${r.id}`,
      title: r.status === 'Assigned' ? 'وافق المحامي على الطلب' : 'تحديث على حالة الطلب',
      body: `طلب ${r.serviceType || 'قانوني'} بحالة: ${r.status || '-'}.`,
      time: fmtDate(r.assignedAt || r.createdAt),
      unread: r.status === 'Assigned',
      sortAt: r.assignedAt || r.createdAt || 0,
      requestId: r.id,
      contractId: undefined,
    }));
    const ctrItems = (Array.isArray(contracts) ? contracts : []).map((c) => {
      const fullySigned = Boolean(c.isSignedByOwner && c.isSignedBySecondParty);
      return {
        id: `c-${c.id}`,
        title: fullySigned ? 'تم توقيع العقد من الطرفين' : 'تم رفع العقد بنجاح',
        body: `${c.templateName || 'العقد'} - الحالة: ${c.status || '-'}.`,
        time: fmtDate(c.createdAt),
        unread: !fullySigned,
        sortAt: c.createdAt || 0,
        contractId: c.id,
        requestId: undefined,
      };
    });
    return [...reqItems, ...ctrItems].sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
    );
  }

  async function load() {
    loading = true;
    loadError = '';
    notifications = [];
    const canApi = isApiConfigured() && !MOCK;
    if (canApi) {
      try {
        const bundle = await miniGetMyNotificationsBundle();
        notifications = (bundle.notifications || [])
          .filter((n) => n && n.id != null)
          .map((n) => ({
            id: n.id,
            title: (n.title && String(n.title).trim()) || 'إشعار',
            body: (n.message && String(n.message).trim()) || '—',
            time: fmtDate(n.createdAt),
            unread: !n.isRead,
            sortAt: n.createdAt || 0,
            requestId: n.requestId,
            contractId: n.contractId,
            rawType: n.type,
          }))
          .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
        setNotificationUnread(Math.max(0, Number(bundle.unreadCount) || 0));
        loading = false;
        return;
      } catch (e) {
        loadError =
          (e && typeof e.message === 'string' && e.message.trim()) ||
          'تعذّر تحميل الإشعارات من السيرفر.';
      }
    }
    try {
      const [requests, contracts] = await Promise.all([miniGetMyRequests(), miniGetMyContracts()]);
      notifications = buildSyntheticFromRequestsContracts(requests, contracts).slice(0, 24);
      setNotificationUnread(notifications.filter((n) => n.unread).length);
    } catch {
      notifications = [];
      setNotificationUnread(0);
    }
    loading = false;
  }

  function isServerNotificationId(id) {
    const s = String(id ?? '');
    return s.length > 0 && !s.startsWith('r-') && !s.startsWith('c-');
  }

  function parseSyntheticPrefixedId(id) {
    const s = String(id);
    if (s.startsWith('r-')) return { kind: /** @type {'request'} */ ('request'), raw: s.slice(2) };
    if (s.startsWith('c-')) return { kind: /** @type {'contract'} */ ('contract'), raw: s.slice(2) };
    return null;
  }

  async function markReadIfNeeded(item) {
    if (!item?.unread) return;
    if (!isApiConfigured() || MOCK) return;
    if (!isServerNotificationId(item.id)) return;
    try {
      await miniMarkNotificationRead(item.id);
      notifications = notifications.map((n) =>
        n.id === item.id ? { ...n, unread: false } : n,
      );
      void refreshNotificationUnread();
    } catch {
      /* ignore */
    }
  }

  function sortByAssignedOrCreatedDesc(list) {
    const arr = Array.isArray(list) ? list : [];
    return [...arr].sort((a, b) => {
      const ta = new Date(
        a?.assignedAt || a?.AssignedAt || a?.createdAt || a?.CreatedAt || 0,
      ).getTime();
      const tb = new Date(
        b?.assignedAt || b?.AssignedAt || b?.createdAt || b?.CreatedAt || 0,
      ).getTime();
      return tb - ta;
    });
  }

  async function tryOpenRequestFromAssignedList() {
    try {
      const list = await miniGetMyRequests();
      const assigned = sortByAssignedOrCreatedDesc(list).filter(
        (r) => r && (r.status === 'Assigned' || r.Status === 'Assigned'),
      );
      const r = assigned[0];
      if (!r) return false;
      const id = r.id ?? r.Id;
      if (id == null || id === '') return false;
      onOpenRequest({
        id,
        title: r.serviceType || r.ServiceType || 'طلب قانوني',
        status: r.status || r.Status || 'Assigned',
        description: r.description || r.Description || '',
        assignedLawyer: r.assignedLawyer || r.AssignedLawyer || null,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function tryOpenContractFromRecent() {
    try {
      const list = await miniGetMyContracts();
      const arr = Array.isArray(list) ? list : [];
      if (!arr.length) return false;
      const sorted = [...arr].sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.CreatedAt || 0).getTime();
        const tb = new Date(b?.createdAt || b?.CreatedAt || 0).getTime();
        return tb - ta;
      });
      const c = sorted[0];
      const id = c.id ?? c.Id ?? c.contractId ?? c.ContractId;
      if (id == null || id === '') return false;
      onOpenContract({
        id,
        title: c.templateName || c.TemplateName || 'عقد',
        status: c.status || c.Status || '',
        issueDate: '',
        endDate: '',
        signed: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function handleNotificationOpen(item) {
    if (!item || item.id == null || opening) return;
    opening = true;
    try {
      await markReadIfNeeded(item);

      const rid = item.requestId;
      if (rid != null && String(rid).trim() !== '') {
        onOpenRequest({
          id: rid,
          title: item.title || 'طلب',
          status: '',
          description: item.body || '',
          assignedLawyer: null,
        });
        return;
      }

      const cid = item.contractId;
      if (cid != null && String(cid).trim() !== '') {
        onOpenContract({
          id: cid,
          title: item.title || 'عقد',
          status: '',
          issueDate: '',
          endDate: '',
          signed: false,
        });
        return;
      }

      const syn = parseSyntheticPrefixedId(item.id);
      if (syn?.kind === 'request' && syn.raw) {
        onOpenRequest({
          id: syn.raw,
          title: item.title || 'طلب',
          status: 'Assigned',
          description: item.body || '',
          assignedLawyer: null,
        });
        return;
      }
      if (syn?.kind === 'contract' && syn.raw) {
        onOpenContract({
          id: syn.raw,
          title: item.title || 'عقد',
          status: '',
          issueDate: '',
          endDate: '',
          signed: false,
        });
        return;
      }

      const text = `${item.title || ''} ${item.body || ''}`;
      if (/طلب|إسناد|اسناد|محام|مسند|تعيين/i.test(text)) {
        if (await tryOpenRequestFromAssignedList()) return;
      }
      if (/عقد/i.test(text)) {
        await tryOpenContractFromRecent();
      }
    } finally {
      opening = false;
    }
  }

  async function markAllRead() {
    if (!isApiConfigured() || MOCK || markingAll) return;
    markingAll = true;
    try {
      await miniMarkAllNotificationsRead();
      notifications = notifications.map((n) => ({ ...n, unread: false }));
      setNotificationUnread(0);
    } catch {
      /* ignore */
    }
    markingAll = false;
  }

  $: hasRealNotifications = notifications.some((n) => {
    const s = String(n.id);
    return !s.startsWith('r-') && !s.startsWith('c-');
  });
  $: unreadReal = hasRealNotifications ? notifications.filter((n) => n.unread).length : 0;

  onMount(() => {
    load();
  });
</script>

<div class="page legal-surface">
  <div class="header">
    <div class="dot">•••</div>
    <h1>الإشعارات</h1>
    <button class="back-btn" type="button" on:click={onBack}>←</button>
  </div>

  <div class="content">
    {#if loadError}
      <p class="fetch-err">{loadError}</p>
    {/if}
    {#if loading}
      <p class="hint">جاري التحميل…</p>
    {:else if hasRealNotifications && unreadReal > 0}
      <button type="button" class="mark-all" on:click={markAllRead} disabled={markingAll}>
        {markingAll ? '…' : 'تعليم الكل كمقروء'}
      </button>
    {/if}
    {#if !loading && notifications.length === 0}
      <p class="hint">لا توجد إشعارات حالياً.</p>
    {/if}
    {#each notifications as item}
      <button
        type="button"
        class="card {item.unread ? 'unread' : ''}"
        on:click={() => handleNotificationOpen(item)}
      >
        <div class="card-head">
          <span class="time">{item.time}</span>
          <h3>{item.title}</h3>
        </div>
        <p>{item.body}</p>
      </button>
    {/each}
  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    active="notifications"
    onNavHome={onGoHome}
    onNavServices={onGoServices}
    onNavContracts={onGoContracts}
    onNavNotifications={onNavNotifications}
    onNavProfile={onGoProfile}
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
    border-radius: 12px;
    padding: 8px;
    font-size: 18px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .header h1 {
    margin: 0;
    text-align: center;
    color: #f8fafc;
    font-size: 20px;
    font-weight: 900;
  }
  .content {
    padding: 14px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .fetch-err {
    background: rgba(251, 191, 36, 0.12);
    border: 1px solid rgba(251, 191, 36, 0.35);
    color: #fde68a;
    padding: 10px 12px;
    border-radius: 14px;
    font-size: 13px;
    margin: 0;
  }
  .hint {
    text-align: center;
    color: rgba(232, 237, 244, 0.55);
    margin: 16px 0;
  }
  .mark-all {
    align-self: flex-end;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(148, 163, 184, 0.25);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    padding: 8px 16px;
    border-radius: 999px;
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 4px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .mark-all:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  .card {
    width: 100%;
    text-align: right;
    border: none;
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 18px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    font-family: inherit;
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }
  .card:hover {
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.3);
  }
  .card.unread {
    border-inline-end: 3px solid rgba(251, 191, 36, 0.85);
    background: rgba(255, 255, 255, 0.09);
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.28),
      0 0 24px rgba(251, 146, 60, 0.08);
  }
  .card-head {
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
  }
  .card-head h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #f1f5f9;
  }
  .time {
    font-size: 12px;
    color: rgba(232, 237, 244, 0.45);
    white-space: nowrap;
  }
  .card p {
    margin: 0;
    font-size: 14px;
    color: rgba(226, 232, 240, 0.72);
    line-height: 1.5;
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
