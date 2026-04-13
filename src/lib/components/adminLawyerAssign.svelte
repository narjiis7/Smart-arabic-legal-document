<script>
  import {
    PRESET_LAWYERS,
    getAssignmentUserKey,
    setLawyerAssignmentForUserKey,
    isAdminSession,
  } from '../assignedLawyer.js';

  export let onBack = () => {};

  /** مفتاح المستخدم المستهدف: فارغ = الحساب الحالي */
  let targetInput = '';
  /** @type {null | (typeof PRESET_LAWYERS)[0]} */
  let selected = null;
  let savedMsg = '';

  function parseTargetKey(raw) {
    const t = (raw || '').trim();
    if (!t) return getAssignmentUserKey();
    if (t.startsWith('email:')) return `email:${t.slice(6).trim().toLowerCase()}`;
    if (t.startsWith('id:')) return `id:${t.slice(3).trim()}`;
    if (t.includes('@')) return `email:${t.toLowerCase()}`;
    return `id:${t}`;
  }

  function save() {
    savedMsg = '';
    if (!isAdminSession()) return;
    const key = parseTargetKey(targetInput);
    if (!key) {
      savedMsg = 'حدّد مستخدماً (بريد أو معرف) أو سجّل دخولاً لتعيين المحامي لحسابك التجريبي.';
      return;
    }
    if (!selected) {
      savedMsg = 'اختر محامياً من القائمة.';
      return;
    }
    setLawyerAssignmentForUserKey(key, selected);
    savedMsg = `تم التعيين للمفتاح: ${key}`;
  }

  $: adminOk = isAdminSession();
</script>

<div class="page" dir="rtl">
  <div class="header">
    <button type="button" class="back-btn" on:click={onBack}>←</button>
    <h1>تعيين محامٍ</h1>
    <span class="hdr-spacer"></span>
  </div>

  <div class="content">
    {#if !adminOk}
      <div class="warn">
        لا تملك صلاحية مسؤول. استخدم حساباً بدور Admin أو فعّل
        <code>VITE_DEV_ADMIN_LAWYER=true</code>
        في <code>.env</code> للتجربة المحلية فقط.
      </div>
    {:else}
      <p class="intro">
        اختر المحامي ثم حدّد المستخدم (بريده أو معرفه). اترك الحقل فارغاً لتعيين المحامي للحساب الذي سجّلت به
        الآن (مفيد للتجربة).
      </p>

      <label class="field-label" for="target-user">المستخدم المستهدف</label>
      <input
        id="target-user"
        class="field"
        type="text"
        placeholder="فارغ = أنا — أو بريد — أو id:المعرّف"
        bind:value={targetInput}
        autocomplete="off"
      />

      <h2 class="sub">المحامون</h2>
      <div class="lawyer-list">
        {#each PRESET_LAWYERS as L}
          <button
            type="button"
            class="lawyer-pick {selected?.id === L.id ? 'on' : ''}"
            on:click={() => (selected = L)}
          >
            <div class="pick-main">
              <span class="pick-name">{L.fullName}</span>
              <span class="pick-spec">{L.specialty}</span>
              <span class="pick-rate">★ {L.ratingAvg} ({L.reviewCount} تقييم)</span>
            </div>
          </button>
        {/each}
      </div>

      <button type="button" class="save-btn" on:click={save}>حفظ التعيين</button>

      {#if savedMsg}
        <p class="feedback" class:bad={savedMsg.startsWith('اختر') || savedMsg.startsWith('حدّد')}>
          {savedMsg}
        </p>
      {/if}
    {/if}
  </div>

  <button type="button" class="back-step-btn" on:click={onBack}>← الرجوع</button>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #f0f3f7;
    display: flex;
    flex-direction: column;
  }
  .header {
    background: #0f2847;
    padding: 16px;
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
  }
  .back-btn {
    border: none;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 18px;
    cursor: pointer;
  }
  .header h1 {
    margin: 0;
    text-align: center;
    color: #fff;
    font-size: 22px;
    font-weight: 900;
  }
  .hdr-spacer {
    width: 36px;
  }
  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .warn {
    background: #fff4e6;
    border: 1px solid #f0c36d;
    color: #7a4b00;
    padding: 14px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.55;
  }
  .warn code {
    font-size: 11px;
    background: rgba(0, 0, 0, 0.06);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .intro {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.55;
    color: #475569;
  }
  .field-label {
    font-size: 12px;
    font-weight: 800;
    color: #1f4572;
    margin-top: 6px;
  }
  .field {
    width: 100%;
    box-sizing: border-box;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    font-size: 15px;
    font-family: inherit;
  }
  .sub {
    margin: 14px 0 6px;
    font-size: 16px;
    font-weight: 900;
    color: #0f172a;
  }
  .lawyer-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .lawyer-pick {
    width: 100%;
    text-align: right;
    padding: 12px 14px;
    border-radius: 14px;
    border: 2px solid #e2e8f0;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
  }
  .lawyer-pick.on {
    border-color: #1f4572;
    background: #f0f6ff;
  }
  .pick-main {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pick-name {
    font-weight: 900;
    font-size: 16px;
    color: #0f172a;
  }
  .pick-spec {
    font-size: 13px;
    color: #64748b;
  }
  .pick-rate {
    font-size: 12px;
    color: #b45309;
    font-weight: 700;
  }
  .save-btn {
    margin-top: 8px;
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 14px;
    background: #1f4572;
    color: #fff;
    font-size: 17px;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
  }
  .feedback {
    margin: 4px 0 0;
    font-size: 13px;
    color: #15803d;
    text-align: center;
  }
  .feedback.bad {
    color: #b91c1c;
  }
  .back-step-btn {
    margin: 0 16px 16px;
    border: 1.5px solid #1f4572;
    background: transparent;
    color: #1f4572;
    border-radius: 14px;
    padding: 12px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    width: calc(100% - 32px);
  }
</style>
