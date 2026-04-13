<script>
  import { onMount } from 'svelte';
  import { miniGetMyContracts } from '../api.js';
  import { isContractArchivedForUi, mapSwaggerContractToListRow } from '../miniContractList.js';
  import { mergeContractListsWithLocal } from '../contractClientDemo.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  export let onNavHome = () => {};
  export let onOpenContract = () => {};
  export let onGoServices = () => {};
  export let onGoNotifications = () => {};
  export let onGoProfile = () => {};
  export let onOpenGenerator = () => {};

  let contracts = [];
  let loadError = '';

  function mapContract(c) {
    return mapSwaggerContractToListRow(/** @type {Record<string, unknown>} */ (c));
  }

  function contractIcon(contract) {
    const t = contract.title || '';
    if (t.includes('إيجار')) return '🏠';
    if (t.includes('عمل')) return '💼';
    if (t.includes('سرية')) return '🔒';
    return '📄';
  }

  onMount(async () => {
    loadError = '';
    try {
      const list = await miniGetMyContracts();
      const apiRows = Array.isArray(list) ? list.map(mapContract) : [];
      contracts = mergeContractListsWithLocal(apiRows);
    } catch (e) {
      const st = /** @type {{ status?: number }} */ (e).status;
      if (st === 401) {
        loadError =
          'طلب العقود رُفض (٤٠١): غير مصرّح. سجّل الدخول من الرئيسية (JWT بدور User حسب Swagger) ثم أعد فتح «عقودي».';
      } else if (st === 403) {
        loadError =
          'لا صلاحية لحسابك لعرض العقود (٤٠٣). جرّب مستخدماً عادياً (User) من توثيق الـ API.';
      } else {
        loadError =
          (e && typeof e.message === 'string' && e.message.trim()) ||
          'تعذّر تحميل قائمة العقود. تأكّد من الجلسة ومن عنوان الخادم في الإعدادات.';
      }
      contracts = mergeContractListsWithLocal([]);
    }
  });

  function statusClass(tone) {
    if (tone === 'green') return 'pill green';
    if (tone === 'red') return 'pill red';
    return 'pill blue';
  }

  $: activeContracts = contracts.filter((c) => !isContractArchivedForUi(c));
  $: archivedContracts = contracts.filter((c) => isContractArchivedForUi(c));
</script>

<div class="page legal-surface">
  <div class="header">
    <div class="dot">•••</div>
    <h1>عقودي</h1>
    <button class="back-btn" on:click={onBack}>←</button>
  </div>

  <div class="content">
    {#if loadError}
      <p class="fetch-err">{loadError}</p>
    {/if}
    <button class="generate-btn" type="button" on:click={onOpenGenerator}>+ توليد عقد جديد</button>

    <div class="contracts-section">
      <h2 class="section-title">العقود النشطة</h2>
      {#if activeContracts.length === 0}
        <p class="empty-hint">لا توجد عقود نشطة حالياً.</p>
      {:else}
        <div class="list-card">
          {#each activeContracts as contract, i}
            <button class="contract-row" type="button" on:click={() => onOpenContract(contract)}>
              <span class={statusClass(contract.tone)}>{contract.status}</span>
              <div class="main">
                <div class="title">{contract.title}</div>
                <div class="meta">ينتهي {contract.endDate}</div>
              </div>
              <span class="icon">{contractIcon(contract)}</span>
            </button>
            {#if i < activeContracts.length - 1}
              <div class="divider"></div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <div class="contracts-section archive-section">
      <h2 class="section-title archive-heading">أرشيف العقود</h2>
      <p class="archive-desc">موقّعة بالكامل، أو منتهية الصلاحية، أو ملغاة / مرفوضة حسب حالة الخادم.</p>
      {#if archivedContracts.length === 0}
        <p class="empty-hint">لا يوجد عقود في الأرشيف بعد.</p>
      {:else}
        <div class="list-card list-card-archive">
          {#each archivedContracts as contract, i}
            <button
              class="contract-row contract-row-archived"
              type="button"
              on:click={() => onOpenContract(contract)}
            >
              <span class={statusClass(contract.tone)}>{contract.status}</span>
              <div class="main">
                <div class="title">{contract.title}</div>
                <div class="meta">ينتهي {contract.endDate}</div>
              </div>
              <span class="icon">{contractIcon(contract)}</span>
            </button>
            {#if i < archivedContracts.length - 1}
              <div class="divider"></div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    active="contracts"
    onNavHome={onNavHome}
    onNavServices={onGoServices}
    onNavContracts={() => {}}
    onNavNotifications={onGoNotifications}
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
  .dot,
  .back-btn {
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #e8edf4;
    font-size: 20px;
    text-align: center;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    gap: 10px;
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
  .generate-btn {
    border: none;
    border-radius: 999px;
    padding: 14px;
    font-size: 15px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    color: #1a1206;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.95), rgba(245, 158, 11, 0.9));
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 0 28px rgba(245, 158, 11, 0.25);
  }
  .contracts-section {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 900;
    color: #e8edf4;
    text-align: right;
  }
  .archive-section .archive-heading {
    color: rgba(226, 232, 240, 0.75);
  }
  .archive-desc {
    margin: -4px 0 4px;
    font-size: 12px;
    line-height: 1.45;
    color: rgba(226, 232, 240, 0.5);
    text-align: right;
  }
  .empty-hint {
    margin: 0;
    padding: 14px 12px;
    text-align: center;
    font-size: 14px;
    color: rgba(232, 237, 244, 0.55);
    background: rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .list-card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 20px;
    padding: 8px 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .contract-row {
    width: 100%;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 4px;
    text-align: right;
    cursor: pointer;
    font-family: inherit;
  }
  .icon { font-size: 24px; }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .title {
    color: #f1f5f9;
    font-size: 18px;
    font-weight: 800;
  }
  .meta {
    color: rgba(226, 232, 240, 0.55);
    font-size: 14px;
  }
  .pill {
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }
  .pill.green { background: #d8f1dd; color: #1f8a4c; }
  .pill.blue { background: #d5edf6; color: #207a92; }
  .pill.red { background: #f7d8dd; color: #a13a4a; }
  .divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
  .list-card-archive {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.07);
  }
  .contract-row-archived .title {
    color: rgba(241, 245, 249, 0.75);
  }
  .contract-row-archived .meta {
    color: rgba(226, 232, 240, 0.45);
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
