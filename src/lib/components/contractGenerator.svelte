<script>
  import { onMount } from 'svelte';
  import {
    isApiConfigured,
    miniGenerateContract,
    miniGetContractTemplates,
    miniGetContractTemplateById,
    miniGetContractTemplateReadyData,
    miniSimulatePayment,
    paymentResponseIsPaid,
    useMockAuth,
  } from '../api.js';
  import { hasAuthToken } from '../session.js';
  import { parseContractFieldsJson } from '../contractFields.js';
  import { PAYMENT_FEES_IQD } from '../paymentFees.js';
  import {
    saveDemoContractSnapshot,
    useMiniContractClientDemo,
  } from '../contractClientDemo.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  export let onNavHome = () => {};
  export let onNavServices = () => {};
  export let onNavContracts = () => {};
  export let onNavNotifications = () => {};
  export let onNavProfile = () => {};
  /** بعد توليد ناجح من الباكند (اختياري — للانتقال لعقودي مثلاً) */
  export let onGenerated = /** @param {Record<string, unknown>} _res */ (_res) => {};
  /** بعد التوليد الناجح — صفحة الدفع (وضع العميل التجريبي المحلي فقط) */
  export let onProceedToPayment = () => {};
  /** بعد الدفع المحاكى على الخادم ثم التوليد الناجح — الانتقال لعقودي */
  export let onContractFlowComplete = () => {};

  let step = 1;
  let selectedType = 'عقد عمل';
  let partyType = 'person-company';
  let duration = 'سنة';

  let employeeName = 'أحمد محمد علي';
  let companyName = 'شركة النور للتجارة';
  let jobTitle = 'مهندس برمجيات';
  let salary = '500,000';
  let feedback = '';
  let selectedTemplateId = null;
  /** قوالب حقيقية من GET /templates أم قائمة تجريبية محلية (بدون رقم قالب للخادم) */
  let templatesSource = /** @type {'server' | 'demo'} */ ('demo');

  /** حقول من fieldsJson أو من ready-data */
  let dynamicFields = [];
  /** قيم مفتاح → نص (مرسلة في data للباكند) */
  let dynamicValues = {};
  /** عند true: body.data يحتوي فقط مفاتيح السيرفر (مثل Swagger) بدون partyType/duration */
  let useStrictReadyDataPayload = false;
  let readyDataLoading = false;
  let readyDataError = '';
  /** لتفسير الفشل بدون تكرار نصوص مضللة (مثلاً ٤٠١: التوليد يحتاج جلسة) */
  let readyDataFailKind = /** @type {'none' | '401' | '403' | 'other'} */ ('none');
  let readyDataFetchGen = 0;

  let contractTypes = [
    { id: 'rent', label: 'عقد إيجار', icon: '🏠' },
    { id: 'work', label: 'عقد عمل', icon: '💼' },
    { id: 'sale', label: 'عقد بيع', icon: '📦' },
    { id: 'partner', label: 'عقد شراكة', icon: '🤝' },
    { id: 'nda', label: 'اتفاقية سرية', icon: '🔒' },
  ];

  const partyOptions = [
    { id: 'person-company', label: 'شخص وشركة' },
    { id: 'two-persons', label: 'شخصين' },
    { id: 'two-companies', label: 'شركتان' },
  ];

  const durationOptions = ['6 أشهر', 'سنة', 'سنتان', 'غير محدد'];
  const steps = [1, 2, 3, 4];

  function iconForType(name) {
    if (!name) return '📄';
    if (name.includes('إيجار')) return '🏠';
    if (name.includes('عمل')) return '💼';
    if (name.includes('بيع')) return '📦';
    if (name.includes('شراكة')) return '🤝';
    if (name.includes('سرية')) return '🔒';
    return '📄';
  }

  /** عقد البيع: مستطيل بعرض صفّين في الشبكة */
  function isWideSaleTemplate(item) {
    const label = item?.label || '';
    const typ = String(item?.type ?? '').toLowerCase();
    if (label.includes('بيع')) return true;
    if (typ.includes('sale')) return true;
    if (item?.id === 'sale') return true;
    return false;
  }

  function humanizeFieldKey(key) {
    const s = String(key)
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(key);
  }

  function valueToInputString(v) {
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function authTokenPresent() {
    return hasAuthToken();
  }

  /**
   * يستخرج كائن الحقول من رد ready-data (أشكال Swagger / ASP.NET شائعة).
   */
  function extractReadyDataObject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const tryObj = (o) => {
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      const keys = Object.keys(o);
      return keys.length ? o : null;
    };
    const nested = [
      raw.data,
      raw.Data,
      raw.result && typeof raw.result === 'object'
        ? raw.result.data ?? raw.result.Data
        : null,
      raw.Result && typeof raw.Result === 'object'
        ? raw.Result.data ?? raw.Result.Data
        : null,
      raw.result,
      raw.Result,
      raw.value,
      raw.Value,
    ];
    for (const c of nested) {
      const t = tryObj(c);
      if (t) return t;
    }
    return null;
  }

  /** كيان قالب واحد من GET .../templates/{id} */
  function extractTemplateDetailObject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const inner =
      raw.data ??
      raw.Data ??
      (raw.result && typeof raw.result === 'object' ? raw.result : null) ??
      (raw.Result && typeof raw.Result === 'object' ? raw.Result : null) ??
      raw;
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return null;
    return inner;
  }

  /** يبني حقولاً من كائن data كما في GET .../templates/{id}/ready-data */
  function fieldsFromPlainDataObject(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    return Object.keys(data).map((key) => {
      const v = data[key];
      let inputType = 'text';
      if (typeof v === 'number' && Number.isFinite(v)) inputType = 'number';
      return {
        key,
        label: humanizeFieldKey(key),
        inputType,
        required: false,
      };
    });
  }

  function applyTemplateFields(item) {
    useStrictReadyDataPayload = false;
    readyDataError = '';
    dynamicFields = parseContractFieldsJson(item?.fieldsJson);
    const next = {};
    for (const f of dynamicFields) {
      next[f.key] = dynamicValues[f.key] ?? '';
    }
    dynamicValues = next;
  }

  async function selectTemplate(item) {
    selectedType = item.label;
    selectedTemplateId = item.templateId ?? item.id ?? null;
    applyTemplateFields(item);
    readyDataFailKind = 'none';

    const gen = ++readyDataFetchGen;
    const tid = item.templateId ?? item.id;

    if (tid == null || tid === '') {
      readyDataLoading = false;
      return;
    }

    const canFetchServer = isApiConfigured() && (useMockAuth() || authTokenPresent());

    if (!canFetchServer) {
      readyDataLoading = false;
      if (dynamicFields.length === 0) {
        readyDataFailKind = 'none';
        readyDataError = '';
        dynamicFields = [];
        dynamicValues = {};
        useStrictReadyDataPayload = false;
      }
      return;
    }

    readyDataLoading = true;
    readyDataError = '';

    try {
      if (dynamicFields.length === 0) {
        try {
          const detailRaw = await miniGetContractTemplateById(tid);
          if (gen !== readyDataFetchGen) return;
          const detail = extractTemplateDetailObject(detailRaw);
          if (detail) {
            const merged = {
              ...item,
              label:
                detail.nameAr ??
                detail.name_ar ??
                detail.NameAr ??
                detail.title ??
                item.label,
              fieldsJson:
                detail.fieldsJson ??
                detail.fields_json ??
                detail.FieldsJson ??
                item.fieldsJson,
              descriptionAr:
                detail.descriptionAr ??
                detail.description_ar ??
                detail.DescriptionAr ??
                item.descriptionAr,
            };
            selectedType = merged.label || selectedType;
            applyTemplateFields(merged);
          }
        } catch {
          /* إن فشل تفاصيل القالب نعتمد على ready-data */
        }
      }

      const raw = await miniGetContractTemplateReadyData(tid);
      if (gen !== readyDataFetchGen) return;
      const data = extractReadyDataObject(raw);

      if (data && Object.keys(data).length) {
        readyDataFailKind = 'none';
        if (dynamicFields.length > 0) {
          const next = { ...dynamicValues };
          for (const f of dynamicFields) {
            if (Object.prototype.hasOwnProperty.call(data, f.key)) {
              next[f.key] = valueToInputString(data[f.key]);
            }
          }
          dynamicValues = next;
          useStrictReadyDataPayload = true;
        } else {
          dynamicFields = fieldsFromPlainDataObject(data);
          const next = {};
          for (const f of dynamicFields) {
            next[f.key] = valueToInputString(data[f.key]);
          }
          dynamicValues = next;
          useStrictReadyDataPayload = true;
        }
      } else if (dynamicFields.length === 0) {
        dynamicFields = [];
        dynamicValues = {};
        useStrictReadyDataPayload = false;
      }
    } catch (e) {
      if (gen !== readyDataFetchGen) return;
      if (dynamicFields.length === 0) {
        dynamicFields = [];
        dynamicValues = {};
        useStrictReadyDataPayload = false;
      }
      const st = /** @type {{ status?: number; message?: string }} */ (e).status;
      if (dynamicFields.length === 0) {
        if (st === 401) {
          readyDataFailKind = '401';
          readyDataError =
            'الخادم رفض التحقق من الجلسة (٤٠١). إمّا انتهت صلاحية رمز الدخول، أو الحساب لا يُقبل لهذا المسار. سجّل خروجاً ثم دخولاً من جديد من الرئيسية، ويفضّل حساب «مستخدم عادي»، ثم أعد فتح «توليد العقد» من البداية.';
        } else if (st === 403) {
          readyDataFailKind = '403';
          readyDataError =
            'حسابك لا يملك صلاحية لهذا الطلب (رمز الخطأ ٤٠٣). جرّب الدخول بحساب «مستخدم عادي» من المستخدمين التجريبيين في توثيق الخدمة، وليس حساب مدير إذا كان النظام يفرّق بينهما.';
        } else {
          readyDataFailKind = 'other';
          readyDataError =
            (e && typeof e.message === 'string' && e.message) ||
            'تعذّر تحميل الحقول من الخادم. تأكّد أنك مسجّل دخولاً وأن الاتصال يعمل.';
        }
      } else {
        readyDataFailKind = 'none';
        readyDataError = '';
      }
    } finally {
      if (gen === readyDataFetchGen) readyDataLoading = false;
    }
  }

  $: usesDynamicFields = dynamicFields.length > 0;

  function isServerTemplateId(id) {
    if (id == null || id === '') return false;
    if (typeof id === 'number' && Number.isFinite(id)) return true;
    const s = String(id).trim();
    if (/^\d+$/.test(s)) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  }

  onMount(async () => {
    if (!isApiConfigured()) {
      templatesSource = 'demo';
      const pick = contractTypes.find((x) => x.label === selectedType) || contractTypes[0];
      if (pick) await selectTemplate(pick);
      return;
    }
    try {
      const templates = await miniGetContractTemplates();
      if (Array.isArray(templates) && templates.length) {
        templatesSource = 'server';
        contractTypes = templates.map((t) => ({
          id: String(t.id),
          templateId: t.id,
          type: t.type,
          label: t.nameAr || t.name_ar || t.type || `قالب ${t.id}`,
          icon: iconForType(t.nameAr || t.name_ar || t.type),
          fieldsJson: t.fieldsJson ?? t.fields_json,
          descriptionAr: t.descriptionAr ?? t.description_ar,
          price: t.price,
        }));
      } else {
        templatesSource = 'demo';
      }
    } catch {
      templatesSource = 'demo';
    }
    const pick = contractTypes.find((x) => x.label === selectedType) || contractTypes[0];
    if (pick) await selectTemplate(pick);
  });

  function goNext() {
    if (step < 3) {
      step += 1;
      return;
    }
  }

  function goPrev() {
    if (step > 1) {
      step -= 1;
      return;
    }
    onBack();
  }

  function progressClass(i) {
    if (i === step) return 'prog active';
    if (i < step) return 'prog done';
    return 'prog';
  }

  function coerceDynamicFieldValue(f, raw) {
    if (raw === '' || raw == null) return raw;
    if (f.inputType === 'number') {
      const n = Number(String(raw).replace(/,/g, ''));
      return Number.isFinite(n) ? n : raw;
    }
    return typeof raw === 'string' ? raw.trim() : raw;
  }

  function buildGeneratePayload() {
    if (useStrictReadyDataPayload && dynamicFields.length > 0) {
      const out = {};
      for (const f of dynamicFields) {
        out[f.key] = coerceDynamicFieldValue(f, dynamicValues[f.key]);
      }
      /* لا نُضيف partyType هنا: Swagger غالباً يقيّد data بمفاتيح القالب فقط؛ إضافته تسبب 400 */
      return out;
    }
    const base = { partyType, duration };
    if (usesDynamicFields) {
      const out = { ...base };
      for (const f of dynamicFields) {
        out[f.key] = coerceDynamicFieldValue(f, dynamicValues[f.key]);
      }
      return out;
    }
    return {
      ...base,
      employeeName,
      companyName,
      jobTitle,
      salary,
    };
  }

  function normalizeTemplateId(id) {
    if (id == null || id === '') return id;
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    const s = String(id).trim();
    if (/^\d+$/.test(s)) return Number(s);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s))
      return s;
    return id;
  }

  /** معرّف العقد من رد التوليد (أشكال متداخلة و PascalCase) */
  function pickGeneratedContractId(res) {
    if (!res || typeof res !== 'object') return null;
    const o = /** @type {Record<string, unknown>} */ (res);
    const d =
      o.data && typeof o.data === 'object' && !Array.isArray(o.data)
        ? /** @type {Record<string, unknown>} */ (o.data)
        : null;
    const r =
      o.result && typeof o.result === 'object' && !Array.isArray(o.result)
        ? /** @type {Record<string, unknown>} */ (o.result)
        : null;
    const candidates = [
      o.id,
      o.contractId,
      o.ContractId,
      d?.id,
      d?.contractId,
      d?.ContractId,
      r?.id,
      r?.contractId,
      r?.ContractId,
    ];
    for (const c of candidates) {
      if (c != null && c !== '') return c;
    }
    return null;
  }

  async function generateContractAfterPayment() {
    feedback = '';
    const localUiOnly = !isApiConfigured() && useMockAuth();

    if (selectedTemplateId == null || selectedTemplateId === '') {
      feedback =
        'لم يُحدَّد قالب العقد. ارجع للخطوة ١ واضغط على بطاقة نوع العقد (القالب) مرة واحدة على الأقل حتى يُحدَّد رقم القالب على الخادم.';
      return;
    }
    if (!localUiOnly && !useMiniContractClientDemo() && !isServerTemplateId(selectedTemplateId)) {
      feedback =
        'القوالب الظاهرة الآن تجريبية وغير مربوطة برقم قالب على الخادم، لذلك لا يمكن توليد عقد حقيقي أو PDF. تأكد من تسجيل الدخول بحساب مستخدم (User)، ومن عنوان الـ API في الإعدادات، ثم أعد فتح «توليد العقد» حتى تُحمَّل أسماء القوالب من السيرفر.';
      return;
    }
    if (usesDynamicFields) {
      const missing = dynamicFields.filter(
        (f) => f.required && !String(dynamicValues[f.key] ?? '').trim(),
      );
      if (missing.length) {
        feedback = `يرجى تعبئة: ${missing.map((m) => m.label).join('، ')}`;
        return;
      }
    }

    try {
      const tid = normalizeTemplateId(selectedTemplateId);
      const payloadData = buildGeneratePayload();

      if (useMiniContractClientDemo()) {
        const feeDemo = PAYMENT_FEES_IQD.contractGenerate;
        const payDemo = await miniSimulatePayment({
          amount: feeDemo,
          paymentContext: 'contract_generation',
        });
        if (!paymentResponseIsPaid(payDemo)) {
          feedback = 'لم يُكمل الدفع على الخادم (الحالة ليست Paid).';
          return;
        }
        const id = `demo-contract-${Date.now()}`;
        saveDemoContractSnapshot({
          id,
          templateName: selectedType,
          templateId: tid,
          data: /** @type {Record<string, unknown>} */ (payloadData),
        });
        const res = {
          id,
          contractId: id,
          templateName: selectedType,
          status: 'Draft',
        };
        const rid = pickGeneratedContractId(res);
        feedback = '';
        if (rid != null && rid !== '' && typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem('legal_app_last_contract_id_pdf', String(rid));
            sessionStorage.setItem('legal_app_contract_pdf_unlocked', '1');
          } catch {
            /* ignore */
          }
        }
        try {
          onGenerated(/** @type {Record<string, unknown>} */ (res));
        } catch {
          /* ignore */
        }
        feedback = 'تم الدفع وتوليد العقد بنجاح.';
        await new Promise((r) => setTimeout(r, 800));
        onContractFlowComplete();
        return;
      }

      const usePascal =
        String(import.meta.env.VITE_MINI_CONTRACT_GENERATE_BODY || '').toLowerCase() === 'pascal';
      const body = usePascal
        ? { TemplateId: tid, Data: payloadData }
        : { templateId: tid, data: payloadData };

      /* Swagger: POST /contracts/generate ثم POST /payments/simulate مع generatedContractId (int) لربط الدفعة بالعقد */
      const res = await miniGenerateContract(body);
      const rid = pickGeneratedContractId(res);
      if (rid == null || rid === '') {
        feedback =
          'أنشأ الخادم الرد لكن بدون معرّف عقد واضح؛ لا يمكن إكمال محاكاة الدفع حسب واجهة الـ API (generatedContractId).';
        return;
      }

      const feeGen = PAYMENT_FEES_IQD.contractGenerate;
      const idNum = Number(rid);
      const payRes = await miniSimulatePayment({
        amount: feeGen,
        generatedContractId: Number.isFinite(idNum) ? Math.trunc(idNum) : rid,
      });
      if (!paymentResponseIsPaid(payRes)) {
        feedback =
          'تم توليد العقد لكن محاكاة الدفع لم تُرجع حالة Paid. يمكنك فتح «عقودي» للتحقق من العقد، ثم إعادة المحاولة إن لزم.';
        try {
          saveDemoContractSnapshot({
            id: String(rid),
            templateName: selectedType,
            templateId: tid,
            data: /** @type {Record<string, unknown>} */ (payloadData),
          });
        } catch {
          /* ignore */
        }
        try {
          onGenerated(res && typeof res === 'object' ? /** @type {Record<string, unknown>} */ (res) : {});
        } catch {
          /* ignore */
        }
        return;
      }

      try {
        saveDemoContractSnapshot({
          id: String(rid),
          templateName: selectedType,
          templateId: tid,
          data: /** @type {Record<string, unknown>} */ (payloadData),
        });
      } catch {
        /* ignore */
      }
      feedback = '';
      if (typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem('legal_app_last_contract_id_pdf', String(rid));
          sessionStorage.setItem('legal_app_contract_pdf_unlocked', '1');
        } catch {
          /* ignore */
        }
      }
      try {
        onGenerated(res && typeof res === 'object' ? /** @type {Record<string, unknown>} */ (res) : {});
      } catch {
        /* ignore */
      }
      feedback = 'تم توليد العقد وتسجيل الدفع المحاكى بنجاح.';
      await new Promise((r) => setTimeout(r, 800));
      onContractFlowComplete();
    } catch (e) {
      feedback =
        (e && typeof e.message === 'string' && e.message) ||
        'تعذّر إنشاء العقد أو إكمال الدفع. تحقّق من الجلسة ومن عنوان الخادم في الإعدادات.';
    }
  }

  function generateContract() {
    const fee = PAYMENT_FEES_IQD.contractGenerate;
    if (typeof onProceedToPayment === 'function') {
      onProceedToPayment(
        {
          kind: 'contract',
          title: 'دفع إصدار العقد',
          amountIqd: fee,
          subtitle: 'بطاقة كي كارد / سوبر كي — بعد الدفع يتم توليد العقد',
          originPage: 'contract-generator',
          afterPay: 'contracts',
        },
        async () => {
          await generateContractAfterPayment();
          return true;
        },
      );
      return;
    }
    void generateContractAfterPayment();
  }
</script>

<div class="page">
  <div class="header">
    <div class="dots">•••</div>
    <h1>{step === 1 ? 'توليد العقد' : step === 2 ? selectedType : 'مراجعة وتوليد'}</h1>
    <div class="time">9:41</div>
  </div>

  <div class="content">
    <div class="progress">
      {#each steps as s}
        <span class={progressClass(s)}></span>
      {/each}
    </div>

    {#if step === 1}
      <div class="section-label">اختر قالب العقد</div>
      <div class="type-grid">
        {#each contractTypes as item}
          <button
            type="button"
            class="type-card {selectedType === item.label ? 'selected' : ''} {isWideSaleTemplate(item)
              ? 'type-card-wide'
              : ''}"
            on:click={() => selectTemplate(item)}
          >
            {#if isWideSaleTemplate(item)}
              <div class="type-card-wide-inner">
                <div class="type-card-wide-text">
                  <span class="type-card-wide-title">{item.label}</span>
                  {#if item.descriptionAr}
                    <span class="type-card-wide-sub">{item.descriptionAr}</span>
                  {/if}
                </div>
                <div class="type-card-wide-icon" aria-hidden="true">{item.icon}</div>
              </div>
            {:else}
              <div class="icon">{item.icon}</div>
              <div>{item.label}</div>
            {/if}
          </button>
        {/each}
      </div>

      <div class="picker-card">
        <div class="field-label">الأطراف</div>
        <div class="chips">
          {#each partyOptions as opt}
            <button
              type="button"
              class="chip {partyType === opt.id ? 'active' : ''}"
              on:click={() => (partyType = opt.id)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if step === 2}
      {#if readyDataLoading}
        <p class="dyn-hint" dir="rtl">
          {usesDynamicFields
            ? 'جاري دمج القيم الافتراضية من الخادم مع الحقول…'
            : 'جاري تحميل القيم الافتراضية من الخادم…'}
        </p>
      {/if}
      {#if usesDynamicFields}
        <p class="dyn-hint" dir="rtl">
          {#if useStrictReadyDataPayload}
            الحقول التالية جاءت من الخادم مع قيم افتراضية. راجعها وعدّل ما تحتاجه، ثم اضغط «التالي».
          {:else}
            الحقول معرّفة على القالب في الخادم. عبِّها كاملةً ثم اضغط «التالي».
          {/if}
        </p>
        {#each dynamicFields as f}
          <div class="input-card">
            <label for="dyn-{f.key}">{f.label}{f.required ? ' *' : ''}</label>
            {#if f.inputType === 'textarea'}
              <textarea id="dyn-{f.key}" rows="3" bind:value={dynamicValues[f.key]} dir="auto"></textarea>
            {:else}
              <input
                id="dyn-{f.key}"
                type={f.inputType === 'number' ? 'number' : 'text'}
                bind:value={dynamicValues[f.key]}
                dir="auto"
              />
            {/if}
          </div>
        {/each}
      {:else if !readyDataLoading}
        {#if readyDataError}
          <div class="dyn-hint fallback-hint ready-data-err" dir="rtl">{readyDataError}</div>
        {/if}
        {#if readyDataFailKind === '403'}
          <p class="dyn-hint fallback-hint session-followup" dir="rtl">
            بيانات النموذج أدناه للمعاينة فقط؛ طالما الصلاحية مرفوضة، لن ينجح التوليد حتى تستخدم حساباً
            مناسباً لمسارات التطبيق المصغّر.
          </p>
        {:else if readyDataError}
          <p class="dyn-hint fallback-hint" dir="rtl">
            يمكنك ملء الحقول يدوياً أدناه والمتابعة للمعاينة؛ إذا اختفت الأخطاء بعد إعادة الاتصال بالخادم، اختر
            القالب من جديد من الخطوة ١ لتحميل القيم تلقائياً.
          </p>
        {:else}
          <p class="dyn-hint fallback-hint" dir="rtl">
            لم تُحمَّل حقول هذا النوع من العقود تلقائياً. عبِّ النموذج أدناه (بيانات عقد عمل أساسية) ثم تابع؛
            أو ارجع للخطوة الأولى واختر نوعاً آخر بعد التأكد من تسجيل الدخول.
          </p>
        {/if}
        <div class="input-card">
          <label for="emp">اسم الموظف</label>
          <input id="emp" bind:value={employeeName} />
        </div>
        <div class="input-card">
          <label for="co">اسم صاحب العمل / الشركة</label>
          <input id="co" bind:value={companyName} />
        </div>
        <div class="input-card">
          <label for="job">المسمى الوظيفي</label>
          <input id="job" bind:value={jobTitle} />
        </div>
        <div class="input-card">
          <label for="sal">الراتب الشهري (دينار)</label>
          <input id="sal" bind:value={salary} />
        </div>
      {/if}
      {#if !useStrictReadyDataPayload}
        <div class="picker-card">
          <div class="field-label">مدة العقد</div>
          <div class="chips">
            {#each durationOptions as item}
              <button
                type="button"
                class="chip {duration === item ? 'active' : ''}"
                on:click={() => (duration = item)}
              >
                {item}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}

    {#if step === 3}
      <div class="review-card">
        <div class="review-title">ملخص العقد</div>
        <div class="row">
          <span>قالب العقد</span><b>{selectedType}</b>
        </div>
        {#if templatesSource === 'server' && selectedTemplateId != null}
          <div class="row row-muted">
            <span>رقم القالب على الخادم</span><b dir="ltr">{selectedTemplateId}</b>
          </div>
        {/if}
        {#if usesDynamicFields}
          {#each dynamicFields as f}
            <div class="row">
              <span>{f.label}</span>
              <b>{dynamicValues[f.key] ?? '—'}</b>
            </div>
          {/each}
        {:else}
          <div class="row"><span>الموظف</span><b>{employeeName}</b></div>
          <div class="row"><span>صاحب العمل</span><b>{companyName}</b></div>
          <div class="row"><span>الراتب</span><b>{salary} د.ع</b></div>
        {/if}
        <div class="row">
          <span>الأطراف</span><b>{partyOptions.find((o) => o.id === partyType)?.label ?? partyType}</b>
        </div>
        {#if !useStrictReadyDataPayload}
          <div class="row"><span>المدة</span><b>{duration}</b></div>
        {/if}
      </div>

      <button class="secondary" type="button" on:click={generateContract}>توليد العقد</button>
      {#if feedback}
        <div class="gen-feedback">{feedback}</div>
      {/if}
    {/if}

    <button class="next" type="button" on:click={step === 3 ? onBack : goNext}>
      {step === 3 ? 'إنهاء ←' : 'التالي ←'}
    </button>
    <button class="back-step-btn" type="button" on:click={goPrev}>← الرجوع</button>
  </div>

  <AppBottomNav
    variant="dark"
    active="contracts"
    onNavHome={onNavHome}
    onNavServices={onNavServices}
    onNavContracts={onNavContracts}
    onNavNotifications={onNavNotifications}
    onNavProfile={onNavProfile}
  />
</div>

<style>
  .page {
    min-height: 100vh;
    background: #0f1a31;
    color: #fff;
    display: flex;
    flex-direction: column;
  }
  .header {
    background: #182a4c;
    padding: 14px 16px;
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    align-items: center;
  }
  .dots,
  .time {
    color: #9aa6bf;
    text-align: center;
    font-size: 14px;
  }
  .header h1 {
    margin: 0;
    text-align: center;
    font-size: 26px;
    font-weight: 900;
  }
  .content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .progress {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 4px 0 10px;
  }
  .prog {
    width: 30px;
    height: 5px;
    background: #2a3f66;
    border-radius: 999px;
  }
  .prog.done,
  .prog.active {
    background: #d0ae4e;
  }
  .section-label {
    color: #d0ae4e;
    font-size: 13px;
    text-align: right;
  }
  .type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
  }
  .type-card {
    background: #1f355b;
    border: 1px solid transparent;
    color: #fff;
    border-radius: 16px;
    padding: 16px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 16px;
    cursor: pointer;
    font-family: inherit;
    min-height: 0;
  }
  .type-card.selected {
    border-color: #d0ae4e;
  }
  .type-card-wide {
    grid-column: 1 / -1;
    padding: 0;
    border-radius: 18px;
    overflow: hidden;
    background: linear-gradient(145deg, #1a3052 0%, #1f355b 45%, #243d5e 100%);
    border: 1px solid rgba(208, 174, 78, 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .type-card-wide.selected {
    border-color: #d0ae4e;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 0 0 1px rgba(208, 174, 78, 0.25);
  }
  .type-card-wide-inner {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 16px 18px;
    min-height: 76px;
    box-sizing: border-box;
    direction: rtl;
  }
  .type-card-wide-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: right;
    min-width: 0;
  }
  .type-card-wide-title {
    font-size: 17px;
    font-weight: 800;
    line-height: 1.35;
    color: #fff;
  }
  .type-card-wide-sub {
    font-size: 12px;
    font-weight: 500;
    color: rgba(200, 210, 230, 0.88);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .type-card-wide-icon {
    font-size: 40px;
    line-height: 1;
    flex-shrink: 0;
    opacity: 0.95;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
  }
  .icon {
    font-size: 28px;
  }
  .picker-card,
  .input-card,
  .review-card {
    background: #1f355b;
    border: 1px solid #31507c;
    border-radius: 16px;
    padding: 14px;
  }
  .field-label {
    color: #a8b3c7;
    margin-bottom: 8px;
    font-size: 13px;
    text-align: right;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .chip {
    border: none;
    background: #2a436d;
    color: #adb8cb;
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .chip.active {
    background: #d0ae4e;
    color: #1a2236;
    font-weight: 800;
  }
  .input-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .input-card label {
    color: #a8b3c7;
    font-size: 13px;
    text-align: right;
  }
  .input-card input,
  .input-card textarea {
    border: 1px solid #49566d;
    background: #30343a;
    color: #fff;
    border-radius: 10px;
    padding: 11px 12px;
    font-size: 16px;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .dyn-hint {
    margin: 0;
    font-size: 12px;
    color: #a8b3c7;
    text-align: right;
    direction: rtl;
    line-height: 1.65;
  }
  .fallback-hint {
    color: #d0ae4e;
  }
  .ready-data-err {
    color: #fca5a5;
  }
  .session-followup strong {
    color: #f0e6d2;
  }
  .review-title {
    color: #d0ae4e;
    font-size: 14px;
    margin-bottom: 8px;
    text-align: right;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    border-bottom: 1px solid #31507c;
  }
  .row:last-child {
    border-bottom: none;
  }
  .row span {
    color: #a8b3c7;
    font-size: 13px;
  }
  .row.row-muted span,
  .row.row-muted b {
    color: #7a8a9e;
    font-size: 13px;
    font-weight: 700;
  }
  .row b {
    font-size: 17px;
  }
  .next {
    margin-top: auto;
    border: 1.5px solid #3d557e;
    background: transparent;
    color: #fff;
    border-radius: 14px;
    padding: 13px;
    font-size: 22px;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
  }
  .secondary {
    border: 1.5px solid #3d557e;
    background: transparent;
    color: #fff;
    border-radius: 14px;
    padding: 12px;
    font-size: 18px;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
  }
  .back-step-btn {
    border: 1.5px solid #3d557e;
    background: transparent;
    color: #fff;
    border-radius: 14px;
    padding: 12px;
    font-size: 18px;
    font-weight: 900;
    font-family: inherit;
    cursor: pointer;
  }
  .gen-feedback {
    text-align: center;
    direction: rtl;
    color: #d0ae4e;
    font-size: 14px;
    margin-top: 4px;
    line-height: 1.5;
    padding: 0 8px;
  }
</style>
