<script>
  /**
   * صفحة دفع بواجهة «بطاقة كي / سوبر كي» — العرض والتحقق المحلي فقط؛
   * ربط API حقيقي لاحقاً عبر الباكند.
   */
  /** @type {{ kind: string; title: string; amountIqd?: number; amountUsd?: number; subtitle?: string; contractId?: string | number | null; originPage?: string }} */
  export let context = {
    kind: '',
    title: 'الدفع',
    amountIqd: 0,
    amountUsd: 0,
    subtitle: '',
    contractId: null,
    originPage: 'home',
  };

  export let onBack = () => {};
  /** بعد نجاح الدفع (محاكاة) — الأب ينقل المستخدم */
  export let onSuccess = () => {};

  let cardNumber = '';
  let expiry = '';
  let cvv = '';
  let holderName = '';
  let processing = false;
  let errorMsg = '';
  let paid = false;

  function digitsOnly(s, max) {
    const d = String(s || '').replace(/\D/g, '');
    return max ? d.slice(0, max) : d;
  }

  function formatCardDisplay(raw) {
    const d = digitsOnly(raw, 19);
    const parts = [];
    for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4));
    return parts.join(' ');
  }

  function formatExpiry(raw) {
    const d = digitsOnly(raw, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }

  function validate() {
    errorMsg = '';
    const pan = digitsOnly(cardNumber, 19);
    if (pan.length < 16) {
      errorMsg = 'أدخل رقم البطاقة كاملاً (16 رقماً على الأقل).';
      return false;
    }
    const exp = digitsOnly(expiry, 4);
    if (exp.length !== 4) {
      errorMsg = 'أدخل تاريخ الانتهاء بصيغة شهر/سنة (MMYY).';
      return false;
    }
    const mm = parseInt(exp.slice(0, 2), 10);
    if (mm < 1 || mm > 12) {
      errorMsg = 'الشهر في تاريخ الانتهاء غير صالح.';
      return false;
    }
    const c = digitsOnly(cvv, 4);
    if (c.length < 3) {
      errorMsg = 'أدخل رمز الأمان (CVV) من ظهر البطاقة.';
      return false;
    }
    if (!holderName.trim() || holderName.trim().length < 3) {
      errorMsg = 'أدخل الاسم كما يظهر على البطاقة.';
      return false;
    }
    return true;
  }

  async function submitPay() {
    if (!validate()) return;
    processing = true;
    errorMsg = '';
    await new Promise((r) => setTimeout(r, 1400));
    processing = false;
    paid = true;
    await new Promise((r) => setTimeout(r, 700));
    onSuccess();
  }

  $: displayCard = formatCardDisplay(cardNumber);
  $: displayExpiry = formatExpiry(expiry);
  $: useUsd = context.amountUsd != null && Number(context.amountUsd) > 0;
  $: amountLine = useUsd
    ? `${Number(context.amountUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `${Number(context.amountIqd || 0).toLocaleString('ar-IQ')} د.ع`;
</script>

<div class="page" dir="rtl">
  <div class="header">
    <button type="button" class="back-btn" disabled={processing} on:click={onBack}>→</button>
    <h1>الدفع الآمن</h1>
    <span class="badge">{useUsd ? 'USD / بطاقة دولية' : 'كي كارد / سوبر كي'}</span>
  </div>

  <div class="content">
    {#if paid}
      <div class="done-card">
        <div class="done-icon">✓</div>
        <p class="done-title">تمت العملية بنجاح</p>
        <p class="done-sub">جاري التحويل…</p>
      </div>
    {:else}
      <div class="summary-card">
        <p class="summary-label">{context.title}</p>
        {#if context.subtitle}
          <p class="summary-sub">{context.subtitle}</p>
        {/if}
        {#if context.contractId != null && context.contractId !== ''}
          <p class="summary-meta">مرجع العقد: <span dir="ltr">{context.contractId}</span></p>
        {/if}
        <p class="amount">
          <span class="amount-label">المبلغ المستحق</span>
          <span class="amount-value" dir="ltr">{amountLine}</span>
        </p>
      </div>

      <p class="hint">
        {#if useUsd}
          أدخل بيانات <strong>بطاقة الدفع</strong> (فيزا / ماستركارد / حسب بوابة الدفع). الربط الفعلي مع
          سوبر كي أو البنك يتم من الخادم لاحقاً.
        {:else}
          أدخل بيانات <strong>بطاقة الدفع</strong> (Qi Card / SuperQi) كما في التطبيق البنكي. الربط الفعلي مع
          بوابة الدفع يتم من الخادم لاحقاً.
        {/if}
      </p>

      <div class="form-card">
        <label class="field">
          <span>رقم البطاقة</span>
          <input
            type="text"
            inputmode="numeric"
            autocomplete="cc-number"
            placeholder="0000 0000 0000 0000"
            dir="ltr"
            value={displayCard}
            on:input={(e) => {
              cardNumber = digitsOnly(e.currentTarget.value, 19);
            }}
            disabled={processing}
          />
        </label>
        <div class="row">
          <label class="field half">
            <span>انتهاء الصلاحية</span>
            <input
              type="text"
              inputmode="numeric"
              autocomplete="cc-exp"
              placeholder="MM/YY"
              dir="ltr"
              value={displayExpiry}
              on:input={(e) => {
                expiry = digitsOnly(e.currentTarget.value, 4);
              }}
              disabled={processing}
            />
          </label>
          <label class="field half">
            <span>CVV</span>
            <input
              type="password"
              inputmode="numeric"
              autocomplete="cc-csc"
              placeholder="•••"
              dir="ltr"
              maxlength="4"
              value={cvv}
              on:input={(e) => (cvv = digitsOnly(e.currentTarget.value, 4))}
              disabled={processing}
            />
          </label>
        </div>
        <label class="field">
          <span>الاسم على البطاقة</span>
          <input
            type="text"
            autocomplete="cc-name"
            placeholder="الاسم باللاتينية كما على البطاقة"
            dir="ltr"
            bind:value={holderName}
            disabled={processing}
          />
        </label>
      </div>

      {#if errorMsg}
        <p class="err">{errorMsg}</p>
      {/if}

      <button type="button" class="btn-pay" disabled={processing} on:click={submitPay}>
        {#if processing}
          جاري التحقق من البطاقة…
        {:else if useUsd}
          ادفع {amountLine}
        {:else}
          ادفع {Number(context.amountIqd || 0).toLocaleString('ar-IQ')} د.ع
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: #141929;
    display: flex;
    flex-direction: column;
  }
  .header {
    background: linear-gradient(145deg, #1e2d45 0%, #152238 100%);
    padding: 18px 16px 20px;
    border-radius: 0 0 22px 22px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(201, 168, 76, 0.25);
  }
  .back-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #fff;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    font-size: 18px;
    cursor: pointer;
  }
  .back-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .header h1 {
    flex: 1;
    color: #fff;
    font-size: 17px;
    font-weight: 800;
    min-width: 0;
  }
  .badge {
    font-size: 11px;
    font-weight: 700;
    color: #c9a84c;
    background: rgba(201, 168, 76, 0.12);
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 76, 0.35);
  }
  .content {
    padding: 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .summary-card {
    background: #1e2d45;
    border-radius: 18px;
    padding: 18px;
    border: 1px solid rgba(201, 168, 76, 0.22);
  }
  .summary-label {
    color: #fff;
    font-weight: 800;
    font-size: 16px;
    margin-bottom: 6px;
  }
  .summary-sub {
    color: #9aacbd;
    font-size: 13px;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  .summary-meta {
    color: #7a8a9e;
    font-size: 12px;
    margin-bottom: 12px;
  }
  .amount {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .amount-label {
    color: #c9a84c;
    font-size: 12px;
    font-weight: 600;
  }
  .amount-value {
    color: #fff;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.02em;
  }
  .hint {
    color: #8899aa;
    font-size: 12px;
    line-height: 1.65;
    padding: 0 4px;
  }
  .form-card {
    background: #1a2438;
    border-radius: 16px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field span {
    color: #c9a84c;
    font-size: 12px;
    font-weight: 600;
  }
  .field input {
    background: #0f1624;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 12px 14px;
    color: #fff;
    font-size: 15px;
    font-family: inherit;
  }
  .field input:focus {
    outline: none;
    border-color: rgba(201, 168, 76, 0.55);
  }
  .field input:disabled {
    opacity: 0.65;
  }
  .row {
    display: flex;
    gap: 12px;
  }
  .half {
    flex: 1;
    min-width: 0;
  }
  .err {
    color: #fca5a5;
    font-size: 13px;
    text-align: center;
  }
  .btn-pay {
    margin-top: 6px;
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, #c9a84c 0%, #a68432 100%);
    color: #141929;
    font-weight: 900;
    font-size: 16px;
    font-family: inherit;
    cursor: pointer;
  }
  .btn-pay:disabled {
    opacity: 0.75;
    cursor: wait;
  }
  .done-card {
    text-align: center;
    padding: 48px 24px;
    background: #1e2d45;
    border-radius: 20px;
    border: 1px solid rgba(74, 222, 128, 0.35);
  }
  .done-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 50%;
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
    font-size: 36px;
    line-height: 64px;
    font-weight: 900;
  }
  .done-title {
    color: #fff;
    font-size: 18px;
    font-weight: 800;
  }
  .done-sub {
    color: #8899aa;
    font-size: 14px;
    margin-top: 8px;
  }
</style>
