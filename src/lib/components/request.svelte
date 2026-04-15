<script>
  import { onMount } from 'svelte';
  import {
    isApiConfigured,
    miniCreateRequest,
    miniSimulatePayment,
    paymentResponseIsPaid,
    useMockAuth,
  } from '../api.js';
  import { loginWithEmailPassword, logout as authLogout } from '../auth.js';
  import { session, refreshSession } from '../session.js';
  import { PAYMENT_FEES_IQD } from '../paymentFees.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  /** تنقّل الشريط السفلي — انتقال مباشر دون المرور بخطوات إضافية */
  export let onNavHome = () => {};
  export let onNavServices = () => {};
  export let onNavContracts = () => {};
  export let onNavNotifications = () => {};
  export let onNavProfile = () => {};
  /** فتح شاشة الدفع قبل إرسال الطلب (مثل التدفق السابق). */
  export let onProceedToPayment = (
    /** @type {{ kind: string; title: string; amountIqd?: number; subtitle?: string; originPage: string; afterPay: string }} */ _ctx,
    /** @type {() => Promise<boolean | void> | boolean | void} */ _afterSuccessAction,
  ) => {};
  /** بعد إتمام الدفع وإنشاء الطلب على الخادم — الانتقال لطلباتي */
  export let onSubmitted = () => {};

  let problemText = '';
  let city = 'بغداد';
  let whatsAppNumber = '';
  let selectedTag = 'عمالية';
  let showPopup = false;
  let pendingType = /** @type {'normal' | 'urgent' | ''} */ ('');
  let feedbackText = '';
  let feedbackKind = /** @type {'error' | 'success' | ''} */ ('');
  let submitting = false;

  let email = '';
  let password = '';
  let loginError = '';
  let loginLoading = false;

  const MOCK_AUTH = useMockAuth();

  const tags = ['عمالية', 'عقارية', 'تجارية', 'أسرية', 'عامة'];

  onMount(() => {
    refreshSession();
  });

  function selectTag(tag) {
    selectedTag = tag;
  }

  function submitRequest(type) {
    feedbackText = '';
    feedbackKind = '';
    if (!problemText.trim()) {
      feedbackKind = 'error';
      feedbackText = 'اكتب وصف المشكلة في المربع أعلاه ثم أعد المحاولة.';
      return;
    }
    if ($session.isLoggedIn) {
      proceedWithPaymentThenSubmit(type);
    } else {
      pendingType = type;
      showPopup = true;
    }
  }

  async function submitEmailLogin() {
    loginError = '';
    loginLoading = true;
    try {
      await loginWithEmailPassword(email, password);
      const t = pendingType;
      showPopup = false;
      email = '';
      password = '';
      pendingType = '';
      if (t === 'normal' || t === 'urgent') proceedWithPaymentThenSubmit(t);
    } catch (e) {
      if (e?.code === 'NO_API_BASE') {
        loginError =
          'اضبط عنوان الـ API في .env أو استخدم بروكسي التطوير (VITE_API_PROXY_TARGET).';
      } else if (
        e?.code === 'VALIDATION' ||
        e?.code === 'BAD_CREDENTIALS' ||
        e?.code === 'NO_TOKEN'
      ) {
        loginError = (e?.message || '').trim() || 'فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.';
      } else {
        loginError = (e && e.message) || 'فشل تسجيل الدخول.';
      }
    }
    loginLoading = false;
  }

  function proceedWithPaymentThenSubmit(type) {
    const fee =
      type === 'urgent' ? PAYMENT_FEES_IQD.lawyerRequestUrgent : PAYMENT_FEES_IQD.lawyerRequestNormal;
    const kind = type === 'urgent' ? 'lawyer-request-urgent' : 'lawyer-request-normal';
    if (typeof onProceedToPayment === 'function') {
      onProceedToPayment(
        {
          kind,
          title: type === 'urgent' ? 'دفع طلب استشارة عاجل' : 'دفع طلب استشارة',
          amountIqd: fee,
          subtitle: 'بطاقة كي كارد / سوبر كي — بعد الدفع يتم إرسال الطلب',
          originPage: 'request',
          afterPay: 'requests',
        },
        async () => {
          await sendRequest(type);
          return true;
        },
      );
      return;
    }
    void sendRequest(type);
  }

  function closeLoginPopup() {
    showPopup = false;
    loginError = '';
    email = '';
    password = '';
    pendingType = '';
  }

  async function sendRequest(type) {
    feedbackKind = '';
    feedbackText = '';
    if (!MOCK_AUTH && !isApiConfigured()) {
      feedbackKind = 'error';
      feedbackText =
        'لم يُضبط عنوان الـ API: املأ VITE_API_BASE_URL أو اتركه فارغاً مع VITE_API_PROXY_TARGET أثناء التطوير.';
      return;
    }
    const wa = (whatsAppNumber || '').replace(/\s/g, '') || '07700000000';
    submitting = true;
    try {
      const fee =
        type === 'urgent'
          ? PAYMENT_FEES_IQD.lawyerRequestUrgent
          : PAYMENT_FEES_IQD.lawyerRequestNormal;
      /** إنشاء الطلب أولاً — SimulatePaymentDto يتطلب consultationRequestId أو generatedContractId مع amount */
      const created = await miniCreateRequest({
        serviceType: selectedTag,
        description: problemText.trim(),
        city: city.trim() || 'بغداد',
        whatsAppNumber: wa,
        isUrgent: type === 'urgent',
      });
      const rawId =
        created && typeof created === 'object'
          ? /** @type {Record<string, unknown>} */ (created).id ??
            /** @type {Record<string, unknown>} */ (created).Id ??
            /** @type {Record<string, unknown>} */ (created).requestId ??
            /** @type {Record<string, unknown>} */ (created).RequestId
          : undefined;
      const idNum = Number(rawId);
      const consultationRequestId =
        Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : rawId != null && rawId !== '' ? rawId : null;
      if (consultationRequestId == null) {
        throw new Error('أنشأ الخادم الطلب دون معرّف واضح؛ لا يمكن ربط الدفع بالطلب.');
      }
      const payRes = await miniSimulatePayment({
        amount: fee,
        consultationRequestId,
        paymentContext: 'lawyer_request',
      });
      if (!paymentResponseIsPaid(payRes)) {
        throw new Error('لم يُكمل الدفع على الخادم (الحالة ليست Paid).');
      }
      problemText = '';
      feedbackKind = 'success';
      feedbackText = 'تم الدفع وتقديم الطلب بنجاح.';
      await new Promise((r) => setTimeout(r, 800));
      onSubmitted();
    } catch (e) {
      feedbackKind = 'error';
      const msg = e?.message || '';
      if (String(msg).includes('Failed to fetch') || String(msg).includes('NetworkError')) {
        feedbackText = 'تعذر الاتصال بالسيرفر. تحقق من تشغيل الباكند أو البروكسي والمنفذ.';
      } else if (e?.status === 401) {
        feedbackText = 'انتهت الجلسة أو غير مصرّح. سجّل الدخول من جديد من الصفحة الرئيسية.';
        await authLogout();
      } else {
        feedbackText = msg ? `تعذر إرسال الطلب: ${msg}` : 'تعذر إرسال الطلب. تحقق من تسجيل الدخول أو إعدادات الـ API.';
      }
    }
    submitting = false;
  }
</script>

<!-- الهيدر -->
<div class="header">
  <button class="back-btn" on:click={onBack}>→</button>
  <h1>طلب خدمة قانونية</h1>
</div>

<!-- المحتوى -->
<div class="content">

  <!-- وصف الطلب -->
  <div class="ai-card">
    <div class="ai-label">📝 تفاصيل الطلب</div>
    <textarea
      bind:value={problemText}
      placeholder="مثال: صاحب العمل لم يدفع راتبي..."
      on:input={() => {
        feedbackText = '';
        feedbackKind = '';
      }}
    ></textarea>
    <div class="extra-fields">
      <label class="mini-label" for="request-city">المدينة</label>
      <input
        id="request-city"
        type="text"
        class="mini-input"
        bind:value={city}
        placeholder="مثال: بغداد، البصرة…"
        dir="rtl"
        on:input={() => {
          feedbackText = '';
          feedbackKind = '';
        }}
      />
      <label class="mini-label" for="request-wa">واتساب للتواصل</label>
      <input
        id="request-wa"
        type="tel"
        class="mini-input"
        bind:value={whatsAppNumber}
        placeholder="07xxxxxxxx"
        dir="ltr"
      />
    </div>
    {#if feedbackText}
      <p class="field-msg" class:error={feedbackKind === 'error'} class:success={feedbackKind === 'success'}>
        {feedbackText}
      </p>
    {/if}
  </div>

  <!-- نوع الخدمة -->
  <div>
    <p class="section-label">اختر نوع الخدمة</p>
    <div class="tags">
      {#each tags as tag}
        <span
          class="tag {selectedTag === tag ? 'active' : ''}"
          on:click={() => selectTag(tag)}
        >{tag}</span>
      {/each}
    </div>
  </div>

  <!-- الأزرار -->
  <div class="buttons">
    <button type="button" class="btn-normal" disabled={submitting} on:click={() => submitRequest('normal')}>
      طلب عادي
    </button>
    <button type="button" class="btn-urgent" disabled={submitting} on:click={() => submitRequest('urgent')}>
      طلب عاجل
      <span class="urgent-dot"></span>
    </button>
  </div>

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

{#if submitting}
  <div class="ai-loading-overlay" aria-busy="true">
    <div class="spinner" aria-hidden="true"></div>
    <p>جاري إرسال الطلب إلى النظام...</p>
  </div>
{/if}

<!-- الـ Popup -->
{#if showPopup}
  <div class="overlay" on:click|self={closeLoginPopup}>
    <div class="popup">
      <div class="popup-icon">🔐</div>
      <h3>تسجيل الدخول</h3>
      {#if loginError}
        <div class="login-err">{loginError}</div>
      {/if}
      <div class="popup-field">
        <label for="email-req">البريد الإلكتروني</label>
        <input
          id="email-req"
          type="email"
          bind:value={email}
          placeholder="user@example.com"
          dir="ltr"
          autocomplete="username"
        />
      </div>
      <div class="popup-field">
        <label for="pass-req">كلمة المرور</label>
        <input
          id="pass-req"
          type="password"
          bind:value={password}
          dir="ltr"
          autocomplete="current-password"
        />
      </div>
      <button
        class="btn-confirm"
        type="button"
        on:click={submitEmailLogin}
        disabled={loginLoading}
      >
        {loginLoading ? 'جاري الدخول...' : 'دخول وإرسال الطلب'}
      </button>
      <button class="btn-cancel" type="button" on:click={closeLoginPopup}>إلغاء</button>
    </div>
  </div>
{/if}

<style>
  .header {
    background: #1a2236;
    padding: 20px;
    border-radius: 0 0 24px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back-btn {
    background: rgba(255,255,255,0.1);
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
    background: #141929;
    min-height: calc(100vh - 140px);
  }
  .ai-card {
    background: #1e2d45;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid rgba(201,168,76,0.2);
  }
  .ai-label {
    font-size: 12px;
    color: #c9a84c;
    margin-bottom: 8px;
    font-weight: 600;
  }
  .ai-card textarea {
    width: 100%;
    background: #162032;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px;
    color: white;
    font-family: inherit;
    font-size: 15px;
    resize: none;
    height: 100px;
    outline: none;
  }
  .ai-card textarea::placeholder { color: #8899aa; }
  .extra-fields {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mini-label {
    font-size: 12px;
    color: #8899aa;
    text-align: right;
  }
  .mini-input {
    width: 100%;
    box-sizing: border-box;
    background: #162032;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 12px 14px;
    color: white;
    font-size: 15px;
    font-family: inherit;
    outline: none;
  }
  .mini-input::placeholder { color: #8899aa; }
  .login-err {
    background: rgba(231,76,60,0.15);
    border: 1px solid rgba(231,76,60,0.35);
    border-radius: 10px;
    padding: 10px;
    color: #f1948a;
    font-size: 13px;
    text-align: right;
  }
  .popup-field {
    text-align: right;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }
  .popup-field label {
    color: #8899aa;
    font-size: 12px;
  }
  .popup-field input {
    width: 100%;
    box-sizing: border-box;
    background: #162032;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 12px 14px;
    color: white;
    font-size: 15px;
    font-family: inherit;
    outline: none;
  }
  .btn-confirm:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .field-msg {
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.4;
  }
  .field-msg.error {
    color: #f1948a;
  }
  .field-msg.success {
    color: #7dcea0;
  }
  .ai-reply {
    margin-top: 12px;
    padding: 14px;
    background: #162032;
    border-radius: 12px;
    border: 1px solid rgba(201, 168, 76, 0.25);
  }
  .ai-reply-label {
    font-size: 12px;
    color: #c9a84c;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .ai-reply-body {
    font-size: 14px;
    line-height: 1.75;
    color: #d0d8e4;
    white-space: pre-wrap;
  }
  .ai-loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 14, 24, 0.82);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    z-index: 250;
    color: #e8ecf2;
    font-size: 15px;
    font-weight: 600;
  }
  .spinner {
    width: 44px;
    height: 44px;
    border: 3px solid rgba(201, 168, 76, 0.25);
    border-top-color: #c9a84c;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .btn-normal:disabled,
  .btn-urgent:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .section-label {
    font-size: 16px;
    font-weight: 700;
    color: white;
    margin-bottom: 10px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tag {
    background: #253348;
    color: #8899aa;
    border-radius: 20px;
    padding: 8px 18px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tag.active {
    background: #c9a84c;
    color: #1a1a1a;
    font-weight: 700;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
  }
  .btn-normal {
    background: #1a2236;
    color: white;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 14px;
    padding: 16px;
    font-size: 17px;
    font-family: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-urgent {
    background: #c9a84c;
    color: #1a1a1a;
    border: none;
    border-radius: 14px;
    padding: 16px;
    font-size: 17px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .urgent-dot {
    width: 10px;
    height: 10px;
    background: #e74c3c;
    border-radius: 50%;
    animation: pulse 1.2s infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.4); opacity: 0.7; }
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
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: flex-end;
    z-index: 100;
  }
  .popup {
    background: #1e2d45;
    width: 100%;
    border-radius: 24px 24px 0 0;
    padding: 32px 24px;
    text-align: center;
    border-top: 1px solid rgba(201,168,76,0.3);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .popup-icon { font-size: 48px; margin-bottom: 4px; }
  .popup h3 { color: white; font-size: 20px; margin: 0; }
  .btn-confirm {
    width: 100%;
    background: #c9a84c;
    color: #1a1a1a;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-size: 16px;
    font-family: inherit;
    font-weight: 800;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .btn-cancel {
    width: 100%;
    background: transparent;
    color: #8899aa;
    border: none;
    padding: 12px;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
  }
</style>