<script>
  import { onMount } from 'svelte';
  import { isApiConfigured, isFrontendOnly } from './lib/api.js';
  import { refreshSession, initSessionBridge } from './lib/session.js';
  import { refreshMiniAccessToken } from './lib/auth.js';
  import Home from './lib/components/home.svelte';
  import Request from './lib/components/request.svelte';
  import Requests from './lib/components/requests.svelte';
  import Contracts from './lib/components/contracts.svelte';
  import ContractGenerator from './lib/components/contractGenerator.svelte';
  import Profile from './lib/components/profile.svelte';
  import Consult from './lib/components/Consult.svelte';
  import RequestDetails from './lib/components/requestDetails.svelte';
  import ContractDetails from './lib/components/contractDetails.svelte';
  import ContractSigning from './lib/components/contractSigning.svelte';
  import Notifications from './lib/components/notifications.svelte';
  import MyLawyer from './lib/components/myLawyer.svelte';
  import AdminLawyerAssign from './lib/components/adminLawyerAssign.svelte';
  import PaymentCheckout from './lib/components/paymentCheckout.svelte';
  import { PAYMENT_FEES_IQD, CONSULT_AI_USD } from './lib/paymentFees.js';
  import { setConsultSubscription } from './lib/consultAccess.js';
  import { refreshNotificationUnread } from './lib/notificationUnread.js';

  function readSigningTokenFromPath() {
    if (typeof window === 'undefined') return '';
    const m = window.location.pathname.match(/^\/signing\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  let urlSigningToken = readSigningTokenFromPath();
  let currentPage = urlSigningToken ? 'signing' : 'home';
  let selectedRequest = null;
  let selectedContract = null;
  let contractBackPage = 'contracts';
  /** من أين فُتحت تفاصيل الطلب: طلباتي أو الإشعارات */
  let requestDetailsBackPage = 'requests';

  /** @type {null | { kind: string; title: string; amountIqd?: number; amountUsd?: number; subtitle?: string; contractId?: string | number | null; originPage: string; afterPay: string }} */
  let paymentContext = null;
  /** يُنفّذ بعد نجاح شاشة الدفع (مثلاً: إنشاء طلب/عقد على الخادم). */
  let paymentAfterSuccessAction = /** @type {null | (() => Promise<boolean | void> | boolean | void)} */ (null);

  let hideApiSetupBanner = false;
  const API_CFG_DISMISS = 'legal_app_hide_api_cfg';
  /** إعادة تركيب «عقودي» بعد دفع إصدار عقد حتى يُقرأ sessionStorage ويظهر زر PDF */
  let contractsScreenKey = 0;

  onMount(async () => {
    hideApiSetupBanner = sessionStorage.getItem(API_CFG_DISMISS) === '1';
    if (typeof localStorage !== 'undefined') {
      const hasAccess = !!(
        localStorage.getItem('accessToken')?.trim() || sessionStorage.getItem('token')?.trim()
      );
      const hasRefresh = !!localStorage.getItem('refreshToken')?.trim();
      if (!hasAccess && hasRefresh) {
        await refreshMiniAccessToken();
      }
    }
    refreshSession();
    void refreshNotificationUnread();
    return initSessionBridge();
  });

  function dismissApiSetupBanner() {
    hideApiSetupBanner = true;
    sessionStorage.setItem(API_CFG_DISMISS, '1');
  }

  function openPaymentCheckout(
    /** @type {{ kind: string; title: string; amountIqd?: number; amountUsd?: number; subtitle?: string; contractId?: string | number | null; originPage: string; afterPay: string }} */ ctx,
    /** @type {null | (() => Promise<boolean | void> | boolean | void)} */ afterSuccessAction = null,
  ) {
    paymentContext = ctx;
    paymentAfterSuccessAction = afterSuccessAction;
    currentPage = 'payment';
  }

  function handlePaymentBack() {
    const p = paymentContext;
    paymentContext = null;
    paymentAfterSuccessAction = null;
    currentPage = p?.originPage || 'home';
  }

  async function handlePaymentSuccess() {
    const ctx = paymentContext;
    const afterSuccessAction = paymentAfterSuccessAction;
    paymentAfterSuccessAction = null;
    if (typeof afterSuccessAction === 'function') {
      try {
        const ok = await afterSuccessAction();
        if (ok === false) {
          paymentContext = null;
          currentPage = ctx?.originPage || 'home';
          return;
        }
      } catch {
        paymentContext = null;
        currentPage = ctx?.originPage || 'home';
        return;
      }
    }
    if (ctx?.kind === 'consult-ai-day') setConsultSubscription('day');
    if (ctx?.kind === 'consult-ai-month') setConsultSubscription('month');
    if (ctx?.kind === 'contract' && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('legal_app_contract_pdf_unlocked', '1');
        const cid = ctx.contractId;
        if (cid != null && cid !== '') {
          sessionStorage.setItem('legal_app_last_contract_id_pdf', String(cid));
        }
      } catch {
        /* ignore */
      }
    }
    const dest = ctx?.afterPay || 'home';
    if (ctx?.kind === 'contract' && dest === 'contracts') {
      contractsScreenKey += 1;
    }
    paymentContext = null;
    currentPage = dest;
  }
</script>

{#if isFrontendOnly()}
  <div class="frontend-only-banner" dir="rtl">
    <p>
      <strong>وضع تطوير الواجهة فقط.</strong>
      الباكند معطّل مؤقتاً (<code>VITE_FRONTEND_ONLY=true</code>)؛ التنقّل والنماذج تعمل ببيانات تجريبية.
      لإعادة الربط: احذف أو اجعل <code>VITE_FRONTEND_ONLY=false</code>، أعد تفعيل
      <code>VITE_API_BASE_URL</code>{#if import.meta.env.PROD}
        في متغيرات Vercel ثم <strong>Redeploy</strong>{:else}، ثم أوقف وأعد تشغيل
        <code>npm run dev</code>{/if}.
    </p>
    <button type="button" class="frontend-only-dismiss" on:click={dismissApiSetupBanner}>
      أخفِ الشريط
    </button>
  </div>
{:else if !isApiConfigured() && !hideApiSetupBanner}
  <div class="api-setup-banner" dir="rtl">
    <p>
      <strong>الربط بالخادم غير مضبوط.</strong>
      {#if import.meta.env.PROD}
        على الاستضافة (مثل Vercel): من <strong>Settings → Environment Variables</strong> أضف
        <code>VITE_API_BASE_URL=https://your-server.com</code>
        (بدون <code>/</code> في النهاية وبدون <code>/swagger</code>) لبيئة
        <strong>Production</strong> (وPreview إن احتجت)، ثم من <strong>Deployments</strong> نفّذ
        <strong>Redeploy</strong> — لأن قيم <code>VITE_*</code> تُدمَج وقت البناء وليس بعده.
      {:else}
        أضف في ملف <code>.env</code> بجانب <code>package.json</code> سطراً مثل:
        <code>VITE_API_BASE_URL=https://your-server.com</code>
        (بدون <code>/</code> في النهاية وبدون <code>/swagger</code>)، ثم أوقف وأعد تشغيل
        <code>npm run dev</code>.
      {/if}
    </p>
    {#if !import.meta.env.PROD}
      <p class="api-setup-alt">
        أو في التطوير المحلي فقط: اترك العنوان فارغاً واضبط
        <code>VITE_API_PROXY_TARGET=https://localhost:7001</code>
        حتى يمرّر Vite طلبات <code>/api</code> للباكند.
      </p>
    {/if}
    <p class="api-setup-alt">
      أو لو تريد إكمال الصفحات بدون باكند: <code>VITE_FRONTEND_ONLY=true</code> (انظر
      <code>.env.example</code>){#if import.meta.env.PROD}؛ أضفه في متغيرات Vercel ثم أعد النشر.{/if}.
    </p>
    <button type="button" class="api-setup-dismiss" on:click={dismissApiSetupBanner}>
      فهمت، أخفِ التنبيه
    </button>
  </div>
{/if}

{#if currentPage === 'signing'}
  <ContractSigning
    token={urlSigningToken}
    onGoHome={() => {
      window.history.replaceState({}, '', '/');
      urlSigningToken = '';
      currentPage = 'home';
    }}
  />
{:else if currentPage === 'payment'}
  {#if paymentContext}
    <PaymentCheckout
      context={paymentContext}
      onBack={handlePaymentBack}
      onSuccess={handlePaymentSuccess}
    />
  {/if}
{:else if currentPage === 'home'}
  <Home
    onGoToRequest={() => currentPage = 'request'}
    onGoToContractGenerator={() => currentPage = 'contract-generator'}
    onGoToRequests={() => currentPage = 'requests'}
    onGoToContracts={() => currentPage = 'contracts'}
    onGoToNotifications={() => (currentPage = 'notifications')}
    onGoToProfile={() => currentPage = 'profile'}
    onGoToConsult={() => currentPage = 'consult'}
  />
{:else if currentPage === 'request'}
  <Request
    onBack={() => currentPage = 'home'}
    onNavHome={() => (currentPage = 'home')}
    onNavServices={() => (currentPage = 'requests')}
    onNavContracts={() => (currentPage = 'contracts')}
    onNavNotifications={() => (currentPage = 'notifications')}
    onNavProfile={() => (currentPage = 'profile')}
    onProceedToPayment={(ctx, afterSuccessAction) => openPaymentCheckout(ctx, afterSuccessAction)}
    onSubmitted={() => (currentPage = 'requests')}
  />
{:else if currentPage === 'requests'}
  <Requests
    onBack={() => currentPage = 'home'}
    onNavHome={() => (currentPage = 'home')}
    onNavServices={() => (currentPage = 'requests')}
    onNavContracts={() => (currentPage = 'contracts')}
    onNavNotifications={() => (currentPage = 'notifications')}
    onNavProfile={() => (currentPage = 'profile')}
    onOpenRequest={(request) => {
      requestDetailsBackPage = 'requests';
      selectedRequest = request;
      currentPage = 'request-details';
    }}
    onOpenContract={(contract) => {
      selectedContract = contract;
      contractBackPage = 'requests';
      currentPage = 'contract-details';
    }}
  />
{:else if currentPage === 'contracts'}
  {#key contractsScreenKey}
    <Contracts
      onBack={() => currentPage = 'home'}
      onNavHome={() => (currentPage = 'home')}
      onGoServices={() => currentPage = 'requests'}
      onGoNotifications={() => (currentPage = 'notifications')}
      onGoProfile={() => currentPage = 'profile'}
      onOpenGenerator={() => currentPage = 'contract-generator'}
      onOpenContract={(contract) => {
        selectedContract = contract;
        contractBackPage = 'contracts';
        currentPage = 'contract-details';
      }}
    />
  {/key}
{:else if currentPage === 'contract-generator'}
  <ContractGenerator
    onBack={() => (currentPage = 'contracts')}
    onNavHome={() => (currentPage = 'home')}
    onNavServices={() => (currentPage = 'requests')}
    onNavContracts={() => (currentPage = 'contracts')}
    onNavNotifications={() => (currentPage = 'notifications')}
    onNavProfile={() => (currentPage = 'profile')}
    onGenerated={() => {}}
    onProceedToPayment={(ctx) => openPaymentCheckout(ctx)}
    onContractFlowComplete={() => {
      contractsScreenKey += 1;
      currentPage = 'contracts';
    }}
  />
{:else if currentPage === 'profile'}
  <Profile
    onBack={() => currentPage = 'home'}
    onGoHome={() => currentPage = 'home'}
    onGoServices={() => currentPage = 'requests'}
    onGoContracts={() => currentPage = 'contracts'}
    onGoRequests={() => currentPage = 'requests'}
    onGoNotifications={() => (currentPage = 'notifications')}
    onGoMyLawyer={() => (currentPage = 'my-lawyer')}
    onGoAdminLawyerAssign={() => (currentPage = 'admin-lawyer-assign')}
  />
{:else if currentPage === 'my-lawyer'}
  <MyLawyer
    onBack={() => (currentPage = 'profile')}
    onNavHome={() => (currentPage = 'home')}
    onGoServices={() => (currentPage = 'requests')}
    onGoContracts={() => (currentPage = 'contracts')}
    onGoNotifications={() => (currentPage = 'notifications')}
    onGoProfile={() => (currentPage = 'profile')}
  />
{:else if currentPage === 'admin-lawyer-assign'}
  <AdminLawyerAssign onBack={() => (currentPage = 'profile')} />
{:else if currentPage === 'notifications'}
  <Notifications
    onBack={() => currentPage = 'profile'}
    onGoHome={() => currentPage = 'home'}
    onGoServices={() => currentPage = 'requests'}
    onGoContracts={() => currentPage = 'contracts'}
    onNavNotifications={() => (currentPage = 'notifications')}
    onGoProfile={() => currentPage = 'profile'}
    onOpenRequest={(request) => {
      requestDetailsBackPage = 'notifications';
      selectedRequest = request;
      currentPage = 'request-details';
    }}
    onOpenContract={(contract) => {
      contractBackPage = 'notifications';
      selectedContract = contract;
      currentPage = 'contract-details';
    }}
  />
{:else if currentPage === 'consult'}
  <Consult
    onBack={() => currentPage = 'home'}
    onBookLawyer={() =>
      openPaymentCheckout({
        kind: 'consult-book',
        title: 'دفع مقدّم حجز محامٍ',
        amountIqd: PAYMENT_FEES_IQD.consultBookingDeposit,
        subtitle: 'بطاقة كي كارد / سوبر كي — بعد الدفع يمكنك إكمال نموذج الطلب',
        originPage: 'consult',
        afterPay: 'request',
      })}
    onSubscribeConsultDay={() =>
      openPaymentCheckout({
        kind: 'consult-ai-day',
        title: 'اشتراك المساعد الذكي — يوم واحد',
        amountIqd: 0,
        amountUsd: CONSULT_AI_USD.dayPass,
        subtitle: 'أسئلة غير محدودة للمساعد الإجرائي لمدة 24 ساعة',
        originPage: 'consult',
        afterPay: 'consult',
      })}
    onSubscribeConsultMonth={() =>
      openPaymentCheckout({
        kind: 'consult-ai-month',
        title: 'اشتراك المساعد الذكي — شهري',
        amountIqd: 0,
        amountUsd: CONSULT_AI_USD.monthPass,
        subtitle: 'أسئلة غير محدودة لمدة 30 يوماً',
        originPage: 'consult',
        afterPay: 'consult',
      })}
    onNavHome={() => (currentPage = 'home')}
    onNavServices={() => (currentPage = 'requests')}
    onNavContracts={() => (currentPage = 'contracts')}
    onNavNotifications={() => (currentPage = 'notifications')}
    onNavProfile={() => (currentPage = 'profile')}
  />
{:else if currentPage === 'request-details'}
  <RequestDetails
    request={selectedRequest}
    onBack={() => (currentPage = requestDetailsBackPage)}
  />
{:else if currentPage === 'contract-details'}
  {#key selectedContract?.id}
    <ContractDetails
      contract={selectedContract}
      onBack={() => currentPage = contractBackPage}
    />
  {/key}
{/if}

<style>
  .api-setup-banner {
    max-width: 420px;
    margin: 0 auto;
    padding: 12px 14px 14px;
    background: #7f1d1d;
    color: #fef2f2;
    font-size: 13px;
    line-height: 1.55;
    border-bottom: 3px solid #fbbf24;
  }
  .api-setup-banner code {
    display: inline;
    font-size: 11px;
    background: rgba(0, 0, 0, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
    word-break: break-all;
  }
  .api-setup-alt {
    margin-top: 10px;
    opacity: 0.95;
    font-size: 12px;
  }
  .api-setup-dismiss {
    margin-top: 12px;
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    font-size: 14px;
  }
  .api-setup-dismiss:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .frontend-only-banner {
    max-width: 420px;
    margin: 0 auto;
    padding: 12px 14px 14px;
    background: #134e4a;
    color: #ecfdf5;
    font-size: 13px;
    line-height: 1.55;
    border-bottom: 3px solid #2dd4bf;
  }
  .frontend-only-banner code {
    display: inline;
    font-size: 11px;
    background: rgba(0, 0, 0, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
    word-break: break-all;
  }
  .frontend-only-dismiss {
    margin-top: 10px;
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    font-size: 13px;
  }
  .frontend-only-dismiss:hover {
    background: rgba(255, 255, 255, 0.18);
  }
</style>