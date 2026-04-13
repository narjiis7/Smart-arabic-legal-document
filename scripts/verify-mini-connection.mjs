/**
 * فحص ربط legal-app مع Mini API — مخرجات واضحة بنقاط (من الصفر للتحقق).
 *
 *   npm run api:verify
 *   node scripts/verify-mini-connection.mjs https://your-server.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readEnvValue(key) {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return '';
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => {
    const t = l.trim();
    return t.startsWith(`${key}=`) && !t.startsWith('#');
  });
  if (!line) return '';
  let v = line.split('=').slice(1).join('=').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function readBaseFromEnv() {
  return readEnvValue('VITE_API_BASE_URL').replace(/\/$/, '');
}

function printIntermittentTips(baseUrl) {
  console.log('');
  console.log('[ملاحظة] ربط يشتغل مرة ومرة لا — تحقق من:');
  console.log('    • نفق Cloudflare (trycloudflare.com): الرابط يتغير كل إعادة تشغيل للنفق → حدّث VITE_API_BASE_URL في .env');
  console.log('    • بعد أي تعديل على .env: أوقف npm run dev (Ctrl+C) ثم شغّله من جديد');
  console.log('    • استخدم دومين ثابت للإنتاج (مثل DigitalOcean) بدل النفق المؤقت إن أمكن');
  console.log('    • VPN / شبكة ضعيفة / DNS: جرّب بدون VPN أو شبكة ثانية');
  console.log('    • إذا api:verify نجح من الطرفية والمتصفح فقط يفشل: امتدادات المتصفح أو كاش — نافذة خاصة أو تعطيل الإضافات');
  console.log('    • جلسة قديمة: امسح localStorage للموقع localhost:5173 أو سجّل خروج من التطبيق');
  if (baseUrl) console.log('    • قارن عنوان الطلب في Network مع:', baseUrl);
}

function walkCauses(err) {
  const lines = [];
  let e = err;
  let d = 0;
  while (e && d < 6) {
    const bits = [];
    if (e.code) bits.push(`code=${e.code}`);
    if (e.errno != null) bits.push(`errno=${e.errno}`);
    if (e.syscall) bits.push(String(e.syscall));
    if (e.hostname) bits.push(`host=${e.hostname}`);
    if (bits.length) lines.push(`${d === 0 ? '' : '  → '}${bits.join(' | ')}`);
    e = e.cause;
    d++;
  }
  return lines;
}

const baseArg = process.argv[2];
const base = (baseArg || readBaseFromEnv() || '').trim().replace(/\/$/, '');
/** جسم تجريبي لمسار Mini — نفس شكل loginWithSuperQiToken في الفرونت */
const loginBody = JSON.stringify({ superQiToken: 'legal-app-probe-not-a-real-token' });

console.log('');
console.log('========== Legal-app — فحص ربط Mini API (نقاط واضحة) ==========');
console.log('');

console.log('[1] عنوان السيرفر (يجب أن يطابق ما في المتصفح عند Network → login)');
if (!base) {
  console.log('    حالة: فشل — VITE_API_BASE_URL غير مضبوط.');
  console.log('    الحل: ضع في legal-app/.env سطراً:');
  console.log('    VITE_API_BASE_URL=https://your-server.com');
  console.log('    (بدون /swagger وبدون / في النهاية)');
  console.log('');
  process.exit(1);
}
console.log('    OK:', base);
if (/teech/i.test(base)) {
  console.log(
    '    [!] تنبيه: خطأ إملائي شائع (teech) — الصحيح غالباً legal-tech داخل اسم الدومين.',
  );
}
console.log('');

console.log('[2] شكل جسم POST /api/mini/auth/login (اختبار اتصال — توكن وهمي)');
console.log('    جسم الاختبار:', loginBody.slice(0, 120) + (loginBody.length > 120 ? '…' : ''));
console.log('');

const loginUrl = `${base}/api/mini/auth/login`;
console.log('[3] طلب تجريبي (توكن وهمي — فقط للتأكد أن السيرفر يستجيب)');
console.log('    POST', loginUrl);

const timeoutMs = Math.max(
  15000,
  Number(process.env.LEGAL_API_VERIFY_TIMEOUT_MS || 60000),
);
const maxAttempts = Math.max(1, Math.min(5, Number(process.env.LEGAL_API_VERIFY_RETRIES || 3)));

async function fetchOnce() {
  const signal =
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
  return fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 legal-app/api-verify',
    },
    body: loginBody,
    ...(signal ? { signal } : {}),
  });
}

let res;
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  try {
    if (attempt > 1) {
      const wait = 2000 * attempt;
      console.log(`    إعادة محاولة ${attempt}/${maxAttempts} بعد ${wait / 1000} ث… (مهلة ${timeoutMs / 1000} ث لكل طلب)`);
      await new Promise((r) => setTimeout(r, wait));
    }
    res = await fetchOnce();
    break;
  } catch (e) {
    if (attempt === maxAttempts) {
      console.log('    حالة: فشل — الطلب ما وصل للسيرفر.');
      console.log('    ', e.message);
      const c = walkCauses(e);
      if (c.length) c.forEach((l) => console.log('   ', l));
      console.log('');
      console.log('[3b] ماذا تعمل بعد فشل الاتصال؟');
      console.log('    • UND_ERR_CONNECT_TIMEOUT = انتهت مهلة الاتصال (شبكة، VPN، DNS، أو السيرفر نائم).');
      console.log('    • جرّب فتح', base, 'في المتصفح ثم أعد', 'npm run api:verify');
      console.log('    • DigitalOcean App: أول طلب بعد سكون قد يطول — أعد التشغيل أو زد المحاولات:');
      console.log('      set LEGAL_API_VERIFY_RETRIES=5 && set LEGAL_API_VERIFY_TIMEOUT_MS=90000 && npm run api:verify');
      console.log('    • تحقق من الإنترنت؛ إن كان نفق trycloudflare لازم يشتغل على جهاز الباكند.');
      printIntermittentTips(base);
      console.log('');
      process.exit(1);
    }
  }
}

const text = await res.text();
console.log('    HTTP', res.status);
if (text) {
  const preview = text.length > 500 ? text.slice(0, 500) + '…' : text;
  console.log('    جسم الرد:', preview);
}
console.log('');

console.log('[4] تفسير رمز HTTP (التوكن وهمي — نجاح الدخول الحقيقي = 200 بعد OTP)');
if (res.status >= 200 && res.status < 300) {
  console.log('    • الاتصال بالسيرفر يعمل (وصل الطلب ورجع رد).');
  console.log(
    '    • 2xx مع superQiToken وهمي: إن كان الإنتاج، راجع أن الباكند يتحقق من توكن سوبر كي الحقيقي (أمان).',
  );
} else if (res.status === 400 || res.status === 401 || res.status === 422) {
  console.log('    • 4xx: السيرفر استلم الطلب والشكل صحيح تقريباً؛ الرفض طبيعي لتوكن مزيف.');
  console.log('    • إذا بالتطبيق يظهر خطأ بعد تسجيل دخول حقيقي: راجع التوكن/الإعدادات/قاعدة البيانات على الباكند.');
} else if (res.status === 404) {
  console.log('    • 404: مسار خاطئ أو API غير منشور على هذا الدومين.');
} else if (res.status >= 500) {
  console.log('    • 5xx: خطأ داخل السيرفر (لوج الباكند).');
} else {
  console.log('    • راجع الرمز والرد أعلاه.');
}
console.log('');
console.log('[5] مسارات Mini إضافية (بدون توكن — متوقع 401)');
const notifUrl = `${base}/api/mini/notifications/my`;
try {
  const nr = await fetch(notifUrl, {
    method: 'GET',
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 legal-app/api-verify' },
    ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? { signal: AbortSignal.timeout(Math.min(timeoutMs, 20000)) }
      : {}),
  });
  console.log('    GET', notifUrl, '→ HTTP', nr.status, nr.status === 401 ? '(طبيعي بدون Bearer)' : '');
} catch (e) {
  console.log('    GET إشعارات:', e?.message || e);
}

console.log('[6] الخطوة التالية في المتصفح');
console.log('    npm run dev → سجّل دخول → Network → اختر login → قارن Request URL مع', base);
printIntermittentTips(base);
console.log('');
console.log('================================================================');
console.log('');
