<script>
  import { onMount } from 'svelte';
  import { askLegalAssistant } from '../ai.js';
  import {
    getConsultAccessState,
    markFreeConsultUsed,
  } from '../consultAccess.js';
  import { CONSULT_AI_USD } from '../paymentFees.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  export let onBookLawyer = () => {};
  export let onSubscribeConsultDay = () => {};
  export let onSubscribeConsultMonth = () => {};
  export let onNavHome = () => {};
  export let onNavServices = () => {};
  export let onNavContracts = () => {};
  export let onNavNotifications = () => {};
  export let onNavProfile = () => {};

  let access = getConsultAccessState();

  function refreshAccess() {
    access = getConsultAccessState();
  }

  onMount(() => refreshAccess());

  let message = '';
  let isLoading = false;
  let response = '';
  let showResult = false;
  let askError = '';

  function formatUntil(ts) {
    try {
      return new Date(ts).toLocaleDateString('ar-IQ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  async function askAI() {
    askError = '';
    if (!message.trim()) {
      askError = 'اكتب مشكلتك أولاً في المربع أعلاه.';
      return;
    }

    const snap = getConsultAccessState();
    if (snap.mode === 'locked') {
      askError = 'انتهت الاستشارتان المجانيتان لهذا الأسبوع. اختر إحدى الباقات أدناه للمتابعة.';
      return;
    }

    isLoading = true;
    showResult = false;

    try {
      response = await askLegalAssistant({
        problem: message.trim(),
        category: 'استشارة عامة',
        urgency: 'normal',
      });
      showResult = true;
      if (snap.mode === 'free_weekly') markFreeConsultUsed();
      refreshAccess();
    } catch (e) {
      const m = e && typeof e.message === 'string' ? e.message : '';
      if (/HTTP\s*401|\[HTTP 401\]/i.test(m)) {
        askError =
          'تحتاج جلسة مسجّلة (JWT) لاستخدام المساعد. سجّل الخروج والدخول من جديد من الرئيسية ثم أعد المحاولة.';
      } else if (m.trim()) {
        askError = m.trim();
      } else {
        askError =
          'حدث خطأ أثناء الاتصال بالمساعد. إن كان العنوان في .env مضبوطاً يُستخدم الخادم؛ وإلا راجع VITE_AI_API_KEY للـ OpenAI أو عيّن VITE_CONSULT_AI_SOURCE=openai.';
      }
    }

    isLoading = false;
  }

  function newQuestion() {
    showResult = false;
    message = '';
    askError = '';
    refreshAccess();
  }

</script>

<div class="page">

  <div class="header">
    <button type="button" class="back-btn" on:click={onBack}>→</button>
    <h1>الاستشارة الإجرائية</h1>
  </div>

  <div class="content">

    {#if showResult}
      <div class="result-card">
        <div class="result-header">
          <span>📋</span>
          <h3>خطواتك المطلوبة</h3>
        </div>
        <div class="result-text">{response}</div>
      </div>

      <div class="actions">
        <button type="button" class="btn-retry" on:click={newQuestion}>
          {#if access.mode === 'unlimited'}
            سؤال جديد
          {:else}
            استشارة جديدة
          {/if}
        </button>
      </div>
    {:else if access.mode === 'locked'}
      <div class="intro-card paywall-intro">
        <div class="intro-icon">🔒</div>
        <h2>انتهت الاستشارتان المجانيتان لهذا الأسبوع</h2>
        <p>
          المساعد الإجرائي يقدّم <strong>استشارتين مجانيتين أسبوعياً</strong>. بعد استهلاكهما يمكنك
          المتابعة عبر باقة مدفوعة:
        </p>
      </div>

      <div class="plans">
        <div class="plan-card">
          <p class="plan-price" dir="ltr">${CONSULT_AI_USD.dayPass}</p>
          <p class="plan-title">يوم كامل</p>
          <p class="plan-desc">أسئلة غير محدودة لمدة 24 ساعة</p>
          <button type="button" class="btn-plan" on:click={onSubscribeConsultDay}>اشترك</button>
        </div>
        <div class="plan-card featured">
          <span class="plan-ribbon">أفضل قيمة</span>
          <p class="plan-price" dir="ltr">${CONSULT_AI_USD.monthPass}</p>
          <p class="plan-title">شهري</p>
          <p class="plan-desc">أسئلة غير محدودة لمدة 30 يوماً</p>
          <button type="button" class="btn-plan primary" on:click={onSubscribeConsultMonth}>اشترك</button>
        </div>
      </div>

      <p class="paywall-note">
        الدفع تجريبي من الواجهة حتى يربط المطوّر بوابة سوبر كي / كي كارد أو الدفع الدولي من الخادم.
      </p>
    {:else}
      <div class="intro-card">
        <div class="intro-icon">🤖</div>
        <h2>المساعد الإجرائي</h2>
        <p>اكتب مشكلتك وسأخبرك بالخطوات والأوراق المطلوبة — بدون حلول قانونية كاملة</p>
      </div>

      {#if access.mode === 'free_weekly'}
        <div class="tier-banner free">
          <span class="tier-dot"></span>
          <span
            ><strong>المجاني هذا الأسبوع:</strong> متبقي {access.remaining} من {access.limit} —
            بعدها: <span dir="ltr">${CONSULT_AI_USD.dayPass}</span> يوم /
            <span dir="ltr">${CONSULT_AI_USD.monthPass}</span> شهرياً</span
          >
        </div>
      {:else if access.mode === 'unlimited'}
        <div class="tier-banner pro">
          <span class="tier-dot pro-dot"></span>
          <span
            ><strong>{access.planLabel}</strong> نشط حتى {formatUntil(access.until)} — يمكنك طرح أسئلة غير
            محدودة</span
          >
        </div>
      {/if}

      <div class="input-card">
        <div class="input-label">✍️ اكتب مشكلتك</div>
        <textarea
          bind:value={message}
          placeholder="مثال: صاحب العمل لم يدفع راتبي من 3 أشهر..."
        ></textarea>
        {#if askError}
          <p class="ask-err">{askError}</p>
        {/if}
      </div>

      <button type="button" class="btn-ask" on:click={askAI} disabled={isLoading}>
        {#if isLoading}
          <span class="loading">جاري التحليل...</span>
        {:else}
          🔍 اعرف خطواتك
        {/if}
      </button>
    {/if}

  </div>

  <button class="back-step-btn" type="button" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    variant="dark"
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
    background: #141929;
  }
  .header {
    background: #1a2236;
    padding: 20px;
    border-radius: 0 0 24px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    font-size: 18px;
    cursor: pointer;
  }
  .header h1 {
    color: white;
    font-size: 18px;
    font-weight: 800;
  }
  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .intro-card {
    background: #1e2d45;
    border-radius: 20px;
    padding: 28px 20px;
    text-align: center;
    border: 1px solid rgba(201, 168, 76, 0.2);
  }
  .intro-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .intro-card h2 {
    color: white;
    font-size: 20px;
    font-weight: 800;
    margin-bottom: 8px;
  }
  .intro-card p {
    color: #8899aa;
    font-size: 14px;
    line-height: 1.6;
  }
  .paywall-intro p {
    text-align: right;
  }
  .tier-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    font-size: 13px;
    line-height: 1.55;
  }
  .tier-banner.free {
    background: rgba(201, 168, 76, 0.12);
    border: 1px solid rgba(201, 168, 76, 0.35);
    color: #e8dcc8;
  }
  .tier-banner.pro {
    background: rgba(46, 204, 113, 0.12);
    border: 1px solid rgba(46, 204, 113, 0.35);
    color: #c8e6d0;
  }
  .tier-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c9a84c;
    margin-top: 6px;
    flex-shrink: 0;
  }
  .tier-dot.pro-dot {
    background: #2ecc71;
  }
  .plans {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .plan-card {
    position: relative;
    background: #1e2d45;
    border-radius: 18px;
    padding: 20px 18px 18px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    text-align: center;
  }
  .plan-card.featured {
    border-color: rgba(201, 168, 76, 0.45);
    box-shadow: 0 0 0 1px rgba(201, 168, 76, 0.15);
  }
  .plan-ribbon {
    position: absolute;
    top: 10px;
    inset-inline-start: 10px;
    font-size: 10px;
    font-weight: 800;
    color: #1a1a1a;
    background: #c9a84c;
    padding: 4px 8px;
    border-radius: 8px;
  }
  .plan-price {
    color: #fff;
    font-size: 32px;
    font-weight: 900;
    margin-bottom: 4px;
  }
  .plan-title {
    color: #c9a84c;
    font-size: 16px;
    font-weight: 800;
    margin-bottom: 6px;
  }
  .plan-desc {
    color: #8899aa;
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 14px;
  }
  .btn-plan {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: #fff;
    font-family: inherit;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
  }
  .btn-plan.primary {
    background: #c9a84c;
    color: #1a1a1a;
    border: none;
  }
  .paywall-note {
    font-size: 11px;
    color: #6b7a8c;
    line-height: 1.55;
    text-align: center;
    padding: 0 8px;
  }
  .input-card {
    background: #1e2d45;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid rgba(201, 168, 76, 0.2);
  }
  .input-label {
    color: #c9a84c;
    font-size: 13px;
    margin-bottom: 10px;
    font-weight: 600;
  }
  .input-card textarea {
    width: 100%;
    background: #162032;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px;
    color: white;
    font-family: inherit;
    font-size: 15px;
    resize: none;
    height: 110px;
    outline: none;
  }
  .input-card textarea::placeholder {
    color: #8899aa;
  }
  .ask-err {
    margin: 10px 0 0;
    font-size: 13px;
    color: #f1948a;
  }
  .btn-ask {
    background: #c9a84c;
    color: #1a1a1a;
    border: none;
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    font-size: 17px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    margin-top: auto;
  }
  .btn-ask:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .loading {
    animation: pulse 1s infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .result-card {
    background: #1e2d45;
    border-radius: 16px;
    padding: 20px;
    border: 1px solid rgba(201, 168, 76, 0.2);
    flex: 1;
  }
  .result-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .result-header span {
    font-size: 24px;
  }
  .result-header h3 {
    color: #c9a84c;
    font-size: 16px;
    font-weight: 800;
  }
  .result-text {
    color: #d0d8e4;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .btn-book {
    background: #1b4f72;
    color: white;
    border: none;
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
  }
  .btn-retry {
    background: transparent;
    color: #8899aa;
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    font-size: 15px;
    font-family: inherit;
    cursor: pointer;
  }
  .back-step-btn {
    margin: 0 16px 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: #fff;
    border-radius: 14px;
    padding: 12px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    width: calc(100% - 32px);
  }
</style>
