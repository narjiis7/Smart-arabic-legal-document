<script>
  import { onMount } from 'svelte';
  import Header from './header.svelte';
  import Banner from './banner.svelte';
  import Services from './services.svelte';
  import AppBottomNav from './appBottomNav.svelte';
  import { loginWithEmailPassword, loginWithSuperQiToken } from '../auth.js';
  import { session, refreshSession } from '../session.js';
  import { theme, toggleTheme } from '../theme.js';

  export let onGoToRequest = () => {};
  export let onGoToContractGenerator = () => {};
  export let onGoToRequests = () => {};
  export let onGoToContracts = () => {};
  export let onGoToNotifications = () => {};
  export let onGoToProfile = () => {};
  export let onGoToConsult = () => {};

  let email = '';
  let password = '';
  /** @type {'email' | 'superqi'} */
  let loginMode = 'email';
  let superQiToken = '';
  let loginLoading = false;
  let activePage = 'home';
  let showPopup = false;
  let errorMsg = '';

  onMount(() => {
    refreshSession();
  });

  function handleNavigate(page) {
    activePage = page;
    if (page === 'services') requireAuth(() => onGoToRequests());
    if (page === 'requests') requireAuth(() => onGoToRequests());
    if (page === 'contracts') requireAuth(() => onGoToContracts());
    if (page === 'notifications') requireAuth(() => onGoToNotifications());
    if (page === 'profile') requireAuth(() => onGoToProfile());
    if (page === 'consult') requireAuth(() => onGoToConsult());
  }

  function requireAuth(action) {
    if ($session.isLoggedIn) {
      action();
    } else {
      showPopup = true;
    }
  }

  function finishLoginSuccess() {
    showPopup = false;
  }

  async function submitEmailLogin() {
    errorMsg = '';
    loginLoading = true;
    try {
      await loginWithEmailPassword(email, password);
      finishLoginSuccess();
    } catch (e) {
      if (e?.code === 'NO_API_BASE') {
        errorMsg =
          'لم يُضبط عنوان خادم التطبيق. راجع ملف الإعدادات أو اسأل المطوّر عن عنوان الواجهة البرمجية الصحيح.';
      } else if (
        e?.code === 'VALIDATION' ||
        e?.code === 'BAD_CREDENTIALS' ||
        e?.code === 'NO_TOKEN'
      ) {
        errorMsg = (e?.message || '').trim() || 'فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.';
      } else {
        errorMsg = (e && e.message) || 'فشل تسجيل الدخول.';
      }
    }
    loginLoading = false;
  }

  function closePopup() {
    showPopup = false;
    errorMsg = '';
    email = '';
    password = '';
    loginMode = 'email';
    superQiToken = '';
  }

  async function submitSuperQiLogin() {
    errorMsg = '';
    loginLoading = true;
    try {
      await loginWithSuperQiToken(superQiToken);
      finishLoginSuccess();
    } catch (e) {
      if (e?.code === 'NO_API_BASE') {
        errorMsg =
          'لم يُضبط عنوان خادم التطبيق. راجع ملف الإعدادات أو اسأل المطوّر عن عنوان الواجهة البرمجية الصحيح.';
      } else if (e?.code === 'VALIDATION' || e?.code === 'BAD_CREDENTIALS' || e?.code === 'NO_TOKEN') {
        errorMsg =
          (e?.message || '').trim() ||
          'فشل التحقق من رمز SuperQi. تأكد أن الرمز حديثاً وأن الباكند مربوط بسوبر كي.';
      } else {
        errorMsg = (e && e.message) || 'فشل تسجيل الدخول عبر SuperQi.';
      }
    }
    loginLoading = false;
  }
</script>

<div class="page home-main">
  <button
    type="button"
    class="theme-fab"
    on:click={() => toggleTheme()}
    title={$theme === 'dark' ? 'وضع نهاري' : 'وضع ليلي'}
    aria-label={$theme === 'dark' ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
  >
    {$theme === 'dark' ? '☀️' : '🌙'}
  </button>

  <Header />

  <div class="content">
    <Banner />

    <Services
      onBookLawyer={() => requireAuth(onGoToRequest)}
      onGoToContractGenerator={() => requireAuth(onGoToContractGenerator)}
      onGoToRequests={() => requireAuth(onGoToRequests)}
      onGoToContracts={() => requireAuth(onGoToContracts)}
      onGoToConsult={() => requireAuth(onGoToConsult)}
    />
  </div>

  <AppBottomNav
    active={activePage}
    onNavHome={() => handleNavigate('home')}
    onNavServices={() => handleNavigate('services')}
    onNavContracts={() => handleNavigate('contracts')}
    onNavNotifications={() => handleNavigate('notifications')}
    onNavProfile={() => handleNavigate('profile')}
  />

</div>

{#if showPopup}
  <div class="overlay" on:click|self={closePopup}>
    <div class="popup">
      <div class="popup-icon">🔐</div>
      <h3>تسجيل الدخول</h3>

      {#if errorMsg}
        <div class="error-msg">{errorMsg}</div>
      {/if}

      <div class="login-mode-seg" role="tablist" aria-label="طريقة الدخول">
        <button
          type="button"
          role="tab"
          class:active={loginMode === 'email'}
          aria-selected={loginMode === 'email'}
          on:click={() => {
            loginMode = 'email';
            errorMsg = '';
          }}
        >
          بريد ومرور
        </button>
        <button
          type="button"
          role="tab"
          class:active={loginMode === 'superqi'}
          aria-selected={loginMode === 'superqi'}
          on:click={() => {
            loginMode = 'superqi';
            errorMsg = '';
          }}
        >
          SuperQi
        </button>
      </div>

      {#if loginMode === 'email'}
        <div class="field">
          <label for="email-home">البريد الإلكتروني</label>
          <input
            id="email-home"
            type="email"
            bind:value={email}
            placeholder="example@email.com"
            dir="ltr"
            autocomplete="username"
          />
        </div>
        <div class="field">
          <label for="pass-home">كلمة المرور</label>
          <input
            id="pass-home"
            type="password"
            bind:value={password}
            dir="ltr"
            autocomplete="current-password"
          />
        </div>
        <button
          class="lt-btn-pill lt-btn-pill-warm"
          type="button"
          on:click={submitEmailLogin}
          disabled={loginLoading}
        >
          {loginLoading ? 'جاري الدخول...' : 'دخول'}
        </button>
      {:else}
        <p class="superqi-hint" dir="rtl">
          الصق الرمز الذي يمرّره تطبيق <strong>SuperQi</strong> للمني آب (أو من مسار الـ WebView حسب توثيق سوبر
          كي). الخادم يستدعي <code dir="ltr">POST …/mini/auth/login</code> مع
          <code dir="ltr">superQiToken</code>.
        </p>
        <div class="field">
          <label for="sq-home">رمز SuperQi</label>
          <textarea
            id="sq-home"
            rows="3"
            bind:value={superQiToken}
            dir="ltr"
            autocomplete="off"
            placeholder="الصق الرمز هنا"
          ></textarea>
        </div>
        <button
          class="lt-btn-pill lt-btn-pill-warm"
          type="button"
          on:click={submitSuperQiLogin}
          disabled={loginLoading}
        >
          {loginLoading ? 'جاري التحقق...' : 'دخول بـ SuperQi'}
        </button>
      {/if}

      <button class="lt-btn-outline-glass" type="button" on:click={closePopup}>إلغاء</button>
    </div>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--lt-bg0);
    transition: background 0.25s ease;
  }

  .theme-fab {
    position: fixed;
    /* بعيد عن حافة الشاشة + نوتش/الجزيرة (safe-area) */
    left: max(10px, env(safe-area-inset-left, 0px));
    top: max(10px, env(safe-area-inset-top, 0px));
    z-index: 40;
    /* 48px ≈ توصية لمس الموبايل (أريح من 40px على الشاشة الحقيقية) */
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    padding: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 1px solid rgba(42, 54, 88, 0.14);
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 2px 12px rgba(26, 34, 56, 0.12);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    font-family: inherit;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease,
      background 0.2s ease;
  }
  .theme-fab:hover {
    box-shadow: 0 4px 16px rgba(26, 34, 56, 0.16);
  }
  .theme-fab:active {
    transform: scale(0.94);
  }

  :global(html[data-theme='dark']) .theme-fab {
    background: linear-gradient(145deg, var(--lt-navy-mid) 0%, var(--lt-navy-deep) 100%);
    border-color: rgba(120, 140, 190, 0.35);
    box-shadow: 0 2px 14px rgba(0, 0, 0, 0.4);
  }

  :global(html[data-theme='dark']) .theme-fab:hover {
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
    border-color: rgba(160, 180, 220, 0.4);
  }

  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 8, 18, 0.72);
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: flex-end;
    z-index: 100;
  }
  .popup {
    width: 100%;
    border-radius: 28px 28px 0 0;
    padding: 32px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: rgba(15, 23, 42, 0.72);
    -webkit-backdrop-filter: blur(22px);
    backdrop-filter: blur(22px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: none;
    box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.45);
  }
  .popup-icon { font-size: 36px; }
  .popup h3 { color: white; font-size: 20px; font-weight: 800; margin: 0; }
  .error-msg {
    background: rgba(231,76,60,0.15);
    border: 1px solid rgba(231,76,60,0.3);
    border-radius: 10px;
    padding: 10px;
    color: #e74c3c;
    font-size: 13px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: right;
  }
  .field label { color: #8899aa; font-size: 12px; }
  .field input {
    background: #162032;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 13px 14px;
    color: white;
    font-size: 15px;
    font-family: inherit;
    outline: none;
    width: 100%;
    box-sizing: border-box;
  }
  .field input::placeholder { color: #8899aa; }
  .popup :global(.lt-btn-pill-warm):disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
