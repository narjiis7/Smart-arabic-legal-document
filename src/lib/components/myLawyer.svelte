<script>
  import { onMount } from 'svelte';
  import {
    miniGetMyAssignedLawyer,
    miniGetMyRequests,
    miniGetLawyerReviews,
    miniPostReview,
    isApiConfigured,
    isFrontendOnly,
  } from '../api.js';
  import {
    getLawyerAssignmentForCurrentUser,
    normalizeAssignedLawyerPayload,
  } from '../assignedLawyer.js';
  import AppBottomNav from './appBottomNav.svelte';

  export let onBack = () => {};
  export let onNavHome = () => {};
  export let onGoServices = () => {};
  export let onGoContracts = () => {};
  export let onGoNotifications = () => {};
  export let onGoProfile = () => {};

  /** @type {Array<{requestId:string|number, requestTitle:string, requestStatus:string, requestDescription:string, createdAt:string, lawyer:{ fullName: string; specialty: string; ratingAvg: number; reviewCount: number; phone: string; lawyerId?: string; lawyerProfileId?: number }}>} */
  let assignments = [];
  let loading = true;

  /** @type {Record<string, Array<{ reviewerFullName: string; rating: number; comment: string; createdAt: string }>>} */
  let reviewsByProfileKey = {};
  /** @type {Record<string, 'idle' | 'loading' | 'ok' | 'err'>} */
  let reviewsLoadByKey = {};
  /** @type {Record<string, { rating: number; comment: string }>} */
  let reviewForms = {};
  /** @type {Record<string, string>} */
  let reviewSubmitErr = {};
  /** @type {Record<string, boolean>} */
  let reviewSubmitting = {};

  function profileKeyForReviews(lawyer) {
    const p = lawyer?.lawyerProfileId;
    if (p != null && Number.isFinite(Number(p)) && Number(p) > 0) return String(Math.trunc(Number(p)));
    const lid = Number(lawyer?.lawyerId);
    if (Number.isFinite(lid) && lid > 0) return String(Math.trunc(lid));
    return '';
  }

  function normalizeReviewRow(r) {
    if (!r || typeof r !== 'object') return null;
    const o = /** @type {Record<string, unknown>} */ (r);
    return {
      reviewerFullName: (o.reviewerFullName ?? o.ReviewerFullName ?? '—').toString(),
      rating: Math.min(5, Math.max(0, Number(o.rating ?? o.Rating) || 0)),
      comment: (o.comment ?? o.Comment ?? '').toString(),
      createdAt: (o.createdAt ?? o.CreatedAt ?? '').toString(),
    };
  }

  function statusAr(s) {
    const m = {
      Pending: 'قيد المراجعة',
      Assigned: 'مُسند لمحامٍ',
      Completed: 'مكتمل',
      Cancelled: 'ملغى',
    };
    return m[s] || s || '—';
  }

  function fmtDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function pickLawyer(rawLawyer) {
    if (!rawLawyer || typeof rawLawyer !== 'object') return null;
    const L = /** @type {Record<string, unknown>} */ (rawLawyer);
    const fullName = (L.fullName || L.name || L.displayName || '').toString().trim();
    if (!fullName) return null;
    const lp = Number(L.lawyerProfileId ?? L.LawyerProfileId ?? L.profileId);
    const lawyerProfileId =
      Number.isFinite(lp) && lp > 0 ? Math.trunc(lp) : undefined;
    return {
      fullName,
      specialty: (L.specialty || L.title || L.experience || L.bio || '').toString().trim(),
      ratingAvg: Math.min(5, Math.max(0, Number(L.ratingAvg ?? L.rating ?? L.averageRating) || 0)),
      reviewCount: Number(L.reviewCount ?? L.reviewsCount ?? L.totalReviews) || 0,
      phone: (L.phone || L.mobile || L.whatsApp || '').toString().replace(/\s/g, ''),
      lawyerId: (L.id || L.lawyerId || '').toString(),
      lawyerProfileId,
    };
  }

  function starsDisplay(rating) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return { full, half, empty };
  }

  async function fetchReviewsForProfileKey(key) {
    if (!key || reviewsLoadByKey[key] === 'loading') return;
    reviewsLoadByKey = { ...reviewsLoadByKey, [key]: 'loading' };
    try {
      const raw = await miniGetLawyerReviews(Number(key));
      const list = Array.isArray(raw) ? raw : [];
      const norm = list.map(normalizeReviewRow).filter(Boolean);
      reviewsByProfileKey = { ...reviewsByProfileKey, [key]: /** @type {any} */ (norm) };
      reviewsLoadByKey = { ...reviewsLoadByKey, [key]: 'ok' };
    } catch {
      reviewsByProfileKey = { ...reviewsByProfileKey, [key]: [] };
      reviewsLoadByKey = { ...reviewsLoadByKey, [key]: 'err' };
    }
  }

  function initReviewForms(rows) {
    const next = { ...reviewForms };
    for (const r of rows) {
      const k = String(r.requestId ?? '');
      if (k && !next[k]) next[k] = { rating: 5, comment: '' };
    }
    reviewForms = next;
  }

  async function submitReview(item) {
    const rid = String(item.requestId ?? '');
    if (!rid) return;
    const cid = Number(rid);
    if (!Number.isFinite(cid) || cid <= 0) {
      reviewSubmitErr = { ...reviewSubmitErr, [rid]: 'معرّف الطلب غير صالح للتقييم.' };
      return;
    }
    const form = reviewForms[rid] || { rating: 5, comment: '' };
    reviewSubmitting = { ...reviewSubmitting, [rid]: true };
    reviewSubmitErr = { ...reviewSubmitErr, [rid]: '' };
    try {
      await miniPostReview({
        consultationRequestId: Math.trunc(cid),
        rating: Math.min(5, Math.max(1, Math.trunc(Number(form.rating) || 5))),
        comment: (form.comment || '').trim(),
      });
      reviewSubmitErr = { ...reviewSubmitErr, [rid]: '' };
      const pk = profileKeyForReviews(item.lawyer);
      if (pk) {
        reviewsLoadByKey = { ...reviewsLoadByKey, [pk]: 'idle' };
        await fetchReviewsForProfileKey(pk);
      }
    } catch (e) {
      const msg = e && typeof e.message === 'string' ? e.message : 'تعذّر إرسال التقييم.';
      reviewSubmitErr = { ...reviewSubmitErr, [rid]: msg };
    }
    reviewSubmitting = { ...reviewSubmitting, [rid]: false };
  }

  onMount(async () => {
    loading = true;
    assignments = [];
    const rows = [];

    try {
      if (isApiConfigured() && !isFrontendOnly()) {
        const reqs = await miniGetMyRequests();
        const list = Array.isArray(reqs) ? reqs : [];
        for (const r of list) {
          if (!r || typeof r !== 'object') continue;
          const row = /** @type {Record<string, unknown>} */ (r);
          const pickedLawyer = pickLawyer(row.assignedLawyer ?? row.AssignedLawyer);
          if (!pickedLawyer) continue;
          rows.push({
            requestId: /** @type {string|number} */ (row.id ?? ''),
            requestTitle: (row.serviceType || row.title || 'طلب قانوني').toString(),
            requestStatus: (row.status || 'Pending').toString(),
            requestDescription: (row.description || '').toString(),
            createdAt: (row.createdAt || row.createdOn || '').toString(),
            lawyer: pickedLawyer,
          });
        }
      }
    } catch {
      /* fallback below */
    }

    let fromApi = null;
    if (rows.length === 0 && isApiConfigured() && !isFrontendOnly()) {
      try {
        const raw = await miniGetMyAssignedLawyer();
        fromApi = normalizeAssignedLawyerPayload(raw);
      } catch {
        fromApi = null;
      }
    }
    const local = getLawyerAssignmentForCurrentUser();
    if (rows.length > 0) {
      assignments = rows;
    } else if (fromApi) {
      assignments = [
        {
          requestId: '',
          requestTitle: 'طلب قانوني',
          requestStatus: 'Assigned',
          requestDescription: '',
          createdAt: '',
            lawyer: {
            fullName: fromApi.fullName,
            specialty: fromApi.specialty,
            ratingAvg: fromApi.ratingAvg,
            reviewCount: fromApi.reviewCount,
            phone: fromApi.phone,
            lawyerId: fromApi.lawyerId,
            lawyerProfileId: fromApi.lawyerProfileId,
          },
        },
      ];
    } else if (local) {
      assignments = [
        {
          requestId: '',
          requestTitle: 'طلب قانوني',
          requestStatus: 'Assigned',
          requestDescription: '',
          createdAt: '',
          lawyer: {
            fullName: local.fullName,
            specialty: local.specialty,
            ratingAvg: local.ratingAvg,
            reviewCount: local.reviewCount,
            phone: local.phone,
            lawyerId: local.lawyerId,
            lawyerProfileId: local.lawyerProfileId,
          },
        },
      ];
    }
    initReviewForms(assignments);

    if (isApiConfigured() && !isFrontendOnly()) {
      const seen = new Set();
      for (const a of assignments) {
        const pk = profileKeyForReviews(a.lawyer);
        if (!pk || seen.has(pk)) continue;
        seen.add(pk);
        await fetchReviewsForProfileKey(pk);
      }
    }

    loading = false;
  });
</script>

<div class="page legal-surface" dir="rtl">

  <div class="header">
    <button type="button" class="back-btn" on:click={onBack}>←</button>
    <h1>محاميي</h1>
    <span class="hdr-spacer"></span>
  </div>

  <div class="content">
    {#if loading}
      <p class="hint">جاري التحميل…</p>
    {:else if assignments.length === 0}
      <div class="empty-card">
        <div class="empty-icon">⚖️</div>
        <p class="empty-title">لم يُعيَّن محامٍ بعد</p>
        <p class="empty-text">
          بعد أن يختار مسؤول النظام محامياً لحسابك، سيظهر هنا الاسم والتقييم ووسيلة التواصل.
        </p>
      </div>
    {:else}
      {#each assignments as item}
        {@const starParts = starsDisplay(item.lawyer.ratingAvg)}
        {@const waHref =
          item.lawyer.phone && String(item.lawyer.phone).replace(/\D/g, '').length >= 10
            ? `https://wa.me/${String(item.lawyer.phone).replace(/^\+/, '').replace(/\D/g, '')}`
            : ''}
        {@const pk = profileKeyForReviews(item.lawyer)}
        {@const rid = String(item.requestId ?? '')}
        <div class="hero-card">
          <p class="case-title">الطلب: {item.requestTitle}</p>
          <div class="case-meta">
            <span class="case-status">{statusAr(item.requestStatus)}</span>
            {#if item.createdAt}
              <span class="case-date">{fmtDate(item.createdAt)}</span>
            {/if}
          </div>
          {#if item.requestDescription}
            <p class="case-desc">{item.requestDescription}</p>
          {/if}

          <div class="divider"></div>

          <div class="avatar">⚖️</div>
          <h2>{item.lawyer.fullName}</h2>
          {#if item.lawyer.specialty}
            <p class="spec">{item.lawyer.specialty}</p>
          {/if}

          <div class="rating-block" aria-label="متوسط التقييم {item.lawyer.ratingAvg} من 5">
            <div class="stars" aria-hidden="true">
              {#each Array(starParts.full) as _}
                <span class="star full">★</span>
              {/each}
              {#if starParts.half}
                <span class="star half-wrap"><span class="half">★</span></span>
              {/if}
              {#each Array(starParts.empty) as _}
                <span class="star empty">★</span>
              {/each}
            </div>
            <div class="rating-meta">
              <span class="avg">{item.lawyer.ratingAvg.toFixed(1)}</span>
              <span class="out">/ 5</span>
              {#if item.lawyer.reviewCount > 0}
                <span class="reviews">({item.lawyer.reviewCount} تقييم)</span>
              {/if}
            </div>
          </div>

          {#if pk && isApiConfigured() && !isFrontendOnly()}
            <div class="lawyer-reviews-block">
              <h3 class="lawyer-reviews-title">تقييمات على هذا المحامي</h3>
              {#if reviewsLoadByKey[pk] === 'loading'}
                <p class="lawyer-reviews-hint">جاري تحميل التقييمات…</p>
              {:else if reviewsLoadByKey[pk] === 'err'}
                <p class="lawyer-reviews-hint err">تعذّر تحميل التقييمات. تحقق من الجلسة.</p>
              {:else if (reviewsByProfileKey[pk] || []).length === 0}
                <p class="lawyer-reviews-hint">لا توجد تقييمات منشورة بعد لهذا الملف.</p>
              {:else}
                <ul class="lawyer-reviews-list">
                  {#each reviewsByProfileKey[pk] || [] as rev}
                    <li class="lawyer-review-row">
                      <div class="lawyer-review-head">
                        <span class="lawyer-review-name">{rev.reviewerFullName}</span>
                        <span class="lawyer-review-stars" aria-hidden="true"
                          >{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span
                        >
                      </div>
                      {#if rev.comment}
                        <p class="lawyer-review-comment">{rev.comment}</p>
                      {/if}
                      {#if rev.createdAt}
                        <p class="lawyer-review-date">{fmtDate(rev.createdAt)}</p>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}

          {#if item.requestStatus === 'Completed' && rid && isApiConfigured() && !isFrontendOnly()}
            <div class="review-submit-block">
              <h3 class="lawyer-reviews-title">قيّم هذه الاستشارة</h3>
              <p class="lawyer-reviews-hint small">
                يُرسل إلى الخادم: <code dir="ltr">POST /api/mini/reviews</code> مع رقم الطلب والدرجة والتعليق.
              </p>
              <div class="rating-pick" role="group" aria-label="اختيار التقييم من 1 إلى 5">
                {#each [1, 2, 3, 4, 5] as n}
                  <button
                    type="button"
                    class:active={(reviewForms[rid]?.rating ?? 5) === n}
                    on:click={() => {
                      reviewForms = { ...reviewForms, [rid]: { ...(reviewForms[rid] || { rating: 5, comment: '' }), rating: n } };
                    }}
                  >
                    {n}
                  </button>
                {/each}
              </div>
              <textarea
                class="review-comment-input"
                rows="3"
                placeholder="تعليقك (اختياري)"
                value={reviewForms[rid]?.comment ?? ''}
                on:input={(e) => {
                  const v = e.currentTarget.value;
                  const cur = reviewForms[rid] || { rating: 5, comment: '' };
                  reviewForms = { ...reviewForms, [rid]: { ...cur, comment: v } };
                }}
              ></textarea>
              {#if reviewSubmitErr[rid]}
                <p class="lawyer-reviews-hint err">{reviewSubmitErr[rid]}</p>
              {/if}
              <button
                type="button"
                class="review-submit-btn"
                disabled={reviewSubmitting[rid]}
                on:click={() => submitReview(item)}
              >
                {reviewSubmitting[rid] ? 'جاري الإرسال…' : 'إرسال التقييم'}
              </button>
            </div>
          {/if}

          {#if waHref}
            <a class="cta" href={waHref} target="_blank" rel="noopener noreferrer">تواصل عبر واتساب</a>
          {:else}
            <p class="muted">رقم التواصل يُضاف من الإدارة عند الحاجة.</p>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <button type="button" class="back-step-btn" on:click={onBack}>← الرجوع</button>

  <AppBottomNav
    active="profile"
    onNavHome={onNavHome}
    onNavServices={onGoServices}
    onNavContracts={onGoContracts}
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
    padding: 14px 16px;
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
  .back-btn {
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #e8edf4;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    font-size: 18px;
    cursor: pointer;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .header h1 {
    margin: 0;
    text-align: center;
    color: #f8fafc;
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
    gap: 14px;
  }
  .hint {
    text-align: center;
    color: rgba(232, 237, 244, 0.5);
    margin-top: 32px;
  }
  .empty-card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 22px;
    padding: 28px 20px;
    text-align: center;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .empty-title {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 900;
    color: #f1f5f9;
  }
  .empty-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.65;
    color: rgba(226, 232, 240, 0.55);
  }
  .hero-card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 22px;
    padding: 24px 20px;
    text-align: center;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .case-title {
    margin: 0 0 6px;
    text-align: right;
    color: #f8fafc;
    font-size: 14px;
    font-weight: 800;
  }
  .case-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .case-status {
    color: #93c5fd;
    background: rgba(59, 130, 246, 0.16);
    border: 1px solid rgba(147, 197, 253, 0.35);
    border-radius: 999px;
    padding: 3px 10px;
  }
  .case-date {
    color: rgba(226, 232, 240, 0.6);
  }
  .case-desc {
    margin: 0;
    text-align: right;
    color: rgba(226, 232, 240, 0.7);
    font-size: 13px;
    line-height: 1.6;
  }
  .divider {
    height: 1px;
    margin: 14px 0 16px;
    background: rgba(255, 255, 255, 0.1);
  }
  .avatar {
    width: 72px;
    height: 72px;
    margin: 0 auto 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.12);
    display: grid;
    place-items: center;
    font-size: 36px;
  }
  .hero-card h2 {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 900;
    color: #f1f5f9;
  }
  .spec {
    margin: 0 0 18px;
    font-size: 14px;
    color: rgba(226, 232, 240, 0.65);
  }
  .rating-block {
    margin-bottom: 20px;
  }
  .stars {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-bottom: 8px;
    font-size: 28px;
    line-height: 1;
  }
  .star.full {
    color: #e6a800;
  }
  .star.empty {
    color: rgba(226, 232, 240, 0.25);
  }
  .half-wrap {
    position: relative;
    display: inline-block;
    width: 1em;
    height: 1em;
    overflow: hidden;
    color: rgba(226, 232, 240, 0.25);
  }
  .half-wrap .half {
    position: absolute;
    left: 0;
    top: 0;
    width: 50%;
    overflow: hidden;
    color: #e6a800;
  }
  .rating-meta {
    font-size: 15px;
    color: rgba(226, 232, 240, 0.75);
  }
  .avg {
    font-weight: 900;
    font-size: 18px;
    color: #7dd3fc;
  }
  .out {
    opacity: 0.7;
    margin-inline-start: 2px;
  }
  .reviews {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: rgba(226, 232, 240, 0.5);
  }
  .cta {
    display: block;
    margin-top: 8px;
    padding: 14px;
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.35), rgba(249, 115, 22, 0.25));
    border: 1px solid rgba(251, 191, 36, 0.45);
    color: #fff8f0;
    text-decoration: none;
    border-radius: 999px;
    font-weight: 800;
    font-size: 16px;
    box-shadow: 0 8px 28px rgba(249, 115, 22, 0.2);
  }
  .muted {
    margin: 8px 0 0;
    font-size: 13px;
    color: rgba(226, 232, 240, 0.45);
  }

  .lawyer-reviews-block,
  .review-submit-block {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: right;
  }
  .lawyer-reviews-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 800;
    color: #e2e8f0;
  }
  .lawyer-reviews-hint {
    margin: 0;
    font-size: 13px;
    color: rgba(226, 232, 240, 0.55);
    line-height: 1.55;
  }
  .lawyer-reviews-hint.small {
    font-size: 12px;
    margin-bottom: 10px;
  }
  .lawyer-reviews-hint.err {
    color: #fca5a5;
  }
  .lawyer-reviews-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .lawyer-review-row {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 12px 14px;
  }
  .lawyer-review-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .lawyer-review-name {
    font-weight: 800;
    font-size: 14px;
    color: #f1f5f9;
  }
  .lawyer-review-stars {
    font-size: 13px;
    color: #e6a800;
    letter-spacing: 1px;
  }
  .lawyer-review-comment {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: rgba(226, 232, 240, 0.78);
  }
  .lawyer-review-date {
    margin: 6px 0 0;
    font-size: 11px;
    color: rgba(226, 232, 240, 0.45);
  }
  .rating-pick {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-bottom: 10px;
  }
  .rating-pick button {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: #e8edf4;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
  }
  .rating-pick button.active {
    background: rgba(251, 191, 36, 0.25);
    border-color: rgba(251, 191, 36, 0.5);
    color: #fef3c7;
  }
  .review-comment-input {
    width: 100%;
    box-sizing: border-box;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(15, 23, 42, 0.5);
    color: #f1f5f9;
    padding: 12px 14px;
    font-size: 14px;
    font-family: inherit;
    margin-bottom: 10px;
    resize: vertical;
    min-height: 72px;
  }
  .review-submit-btn {
    width: 100%;
    padding: 14px;
    border-radius: 999px;
    border: 1px solid rgba(147, 197, 253, 0.4);
    background: rgba(59, 130, 246, 0.22);
    color: #e0f2fe;
    font-weight: 800;
    font-size: 15px;
    font-family: inherit;
    cursor: pointer;
  }
  .review-submit-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
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
