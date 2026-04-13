/** مفتاح: استُخدمت الإجابة المجانية الواحدة للمساعد AI */
const FREE_USED_KEY = 'legal_consult_free_answer_used';
/** مفتاح: اشتراك يومي أو شهري { type: 'day'|'month', until: number } */
const SUB_KEY = 'legal_consult_ai_subscription';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

/**
 * @returns {{ mode: 'unlimited'; until: number; planLabel: string } | { mode: 'one_free' } | { mode: 'locked' }}
 */
export function getConsultAccessState() {
  if (typeof localStorage === 'undefined') return { mode: 'one_free' };
  const raw = localStorage.getItem(SUB_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      const until = Number(p.until);
      if (Number.isFinite(until) && until > Date.now()) {
        const type = p.type === 'month' ? 'month' : 'day';
        return {
          mode: 'unlimited',
          until,
          planLabel: type === 'month' ? 'الاشتراك الشهري' : 'تمريرة اليوم',
        };
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem(SUB_KEY);
  }
  if (localStorage.getItem(FREE_USED_KEY) === '1') return { mode: 'locked' };
  return { mode: 'one_free' };
}

export function markFreeConsultUsed() {
  if (typeof localStorage !== 'undefined') localStorage.setItem(FREE_USED_KEY, '1');
}

/**
 * @param {'day' | 'month'} type
 */
export function setConsultSubscription(type) {
  if (typeof localStorage === 'undefined') return;
  const now = Date.now();
  const until = type === 'month' ? now + MONTH_MS : now + DAY_MS;
  localStorage.setItem(SUB_KEY, JSON.stringify({ type, until }));
}

/**
 * يمسح حالة الاستشارة المحلية: الإجابة المجانية + اشتراك اليوم/الشهر التجريبي.
 * للتدريب والعرض؛ في الإنتاج يمكن للمستخدم إعادة المحاولة بنفس المفتاح من DevTools.
 */
export function resetConsultAccessForDemo() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(FREE_USED_KEY);
  localStorage.removeItem(SUB_KEY);
}
