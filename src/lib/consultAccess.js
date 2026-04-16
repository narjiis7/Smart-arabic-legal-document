/** مفتاح: الاستخدامات المجانية الأسبوعية { weekStart: number, used: number } */
const FREE_WEEKLY_KEY = 'legal_consult_free_weekly_usage';
/** مفتاح قديم: إجابة مجانية واحدة (للتوافق فقط) */
const LEGACY_FREE_USED_KEY = 'legal_consult_free_answer_used';
/** مفتاح: اشتراك يومي أو شهري { type: 'day'|'month', until: number } */
const SUB_KEY = 'legal_consult_ai_subscription';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;
const FREE_WEEKLY_LIMIT = 2;

function getWeekStart(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay(); // 0 = الأحد
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function readWeeklyUsage(weekStart) {
  if (typeof localStorage === 'undefined') return { weekStart, used: 0 };

  const legacyUsed = localStorage.getItem(LEGACY_FREE_USED_KEY) === '1';
  if (legacyUsed) {
    localStorage.removeItem(LEGACY_FREE_USED_KEY);
    return { weekStart, used: 1 };
  }

  const raw = localStorage.getItem(FREE_WEEKLY_KEY);
  if (!raw) return { weekStart, used: 0 };

  try {
    const parsed = JSON.parse(raw);
    const savedWeekStart = Number(parsed.weekStart);
    const savedUsed = Number(parsed.used);
    if (
      Number.isFinite(savedWeekStart) &&
      Number.isFinite(savedUsed) &&
      savedWeekStart === weekStart &&
      savedUsed >= 0
    ) {
      return { weekStart, used: Math.min(Math.floor(savedUsed), FREE_WEEKLY_LIMIT) };
    }
  } catch {
    /* ignore */
  }

  return { weekStart, used: 0 };
}

function writeWeeklyUsage(usage) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(FREE_WEEKLY_KEY, JSON.stringify(usage));
}

/**
 * @returns {{
 *   mode: 'unlimited';
 *   until: number;
 *   planLabel: string;
 * } | {
 *   mode: 'free_weekly';
 *   used: number;
 *   remaining: number;
 *   limit: number;
 * } | {
 *   mode: 'locked';
 *   used: number;
 *   remaining: 0;
 *   limit: number;
 * }}
 */
export function getConsultAccessState() {
  if (typeof localStorage === 'undefined') {
    return { mode: 'free_weekly', used: 0, remaining: FREE_WEEKLY_LIMIT, limit: FREE_WEEKLY_LIMIT };
  }

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

  const weekStart = getWeekStart();
  const usage = readWeeklyUsage(weekStart);
  const used = Math.min(usage.used, FREE_WEEKLY_LIMIT);
  const remaining = Math.max(FREE_WEEKLY_LIMIT - used, 0);

  if (usage.weekStart !== weekStart || usage.used !== used) {
    writeWeeklyUsage({ weekStart, used });
  }

  if (remaining === 0) {
    return { mode: 'locked', used, remaining: 0, limit: FREE_WEEKLY_LIMIT };
  }

  return { mode: 'free_weekly', used, remaining, limit: FREE_WEEKLY_LIMIT };
}

export function markFreeConsultUsed() {
  if (typeof localStorage === 'undefined') return;
  const weekStart = getWeekStart();
  const usage = readWeeklyUsage(weekStart);
  const used = Math.min(usage.used + 1, FREE_WEEKLY_LIMIT);
  writeWeeklyUsage({ weekStart, used });
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

