/**
 * يطبع رمز HTTP لـ POST /api/mini/auth/login
 *
 *   npm run api:login-status
 *   node scripts/check-login-status.mjs https://your-server.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readBaseFromEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return '';
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith('VITE_API_BASE_URL='));
  if (!line) return '';
  let v = line.split('=').slice(1).join('=').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.replace(/\/$/, '');
}

function walkCauses(err) {
  const lines = [];
  let e = err;
  let d = 0;
  while (e && d < 6) {
    const bits = [];
    if (e.code) bits.push(`code=${e.code}`);
    if (e.errno != null) bits.push(`errno=${e.errno}`);
    if (e.syscall) bits.push(`${e.syscall}`);
    if (e.address) bits.push(`address=${e.address}`);
    if (e.port) bits.push(`port=${e.port}`);
    if (e.hostname) bits.push(`host=${e.hostname}`);
    const msg = (e.message || '').trim();
    if (bits.length) lines.push(`${d === 0 ? '' : '  → '}${bits.join(' | ')}`);
    else if (msg && msg !== 'fetch failed') lines.push(`${d === 0 ? '' : '  → '}${msg}`);
    e = e.cause;
    d++;
  }
  return lines;
}

function hintForNetwork(err) {
  const s = JSON.stringify(err) + (err?.cause?.code || '') + (err?.code || '');
  if (s.includes('ENOTFOUND')) return 'DNS: العنوان غير معروف — تحقق من VITE_API_BASE_URL';
  if (s.includes('ECONNREFUSED')) return 'السيرفر يرفض الاتصال — شغّل الباكند أو تحقق من المنفذ';
  if (s.includes('CERT') || s.includes('certificate')) return 'مشكلة شهادة SSL — جرّب رابطاً آخر أو localhost';
  if (s.includes('ETIMEDOUT') || s.includes('timeout')) return 'انتهت مهلة الانتظار — النفق/السيرفر غير متاح';
  return 'تحقق: النفق (Cloudflare) شغّال؟ الرابط يفتح من المتصفح؟ جرّب نفس الرابط يدوياً في الأمر أدناه.';
}

const baseArg = process.argv[2];
const base = (baseArg || readBaseFromEnv() || '').trim();

if (!base) {
  console.error('No base URL. Set VITE_API_BASE_URL in .env or run:');
  console.error('  node scripts/check-login-status.mjs https://your-server.com');
  process.exit(1);
}

const url = `${base}/api/mini/auth/login`;
/** جسم تجريبي مطابق شكل الفرونت (SuperQi) — للتحقق من استجابة السيرفر فقط */
const body = JSON.stringify({ superQiToken: 'test-superqi-token-placeholder' });

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) legal-app/api-check',
};

let res;
try {
  const ctrl = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined;
  res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    ...(ctrl ? { signal: ctrl } : {}),
  });
} catch (e) {
  console.error('');
  console.error('Connection failed (no HTTP status — request did not complete).');
  console.error('URL:', url);
  console.error('Message:', e.message);
  const causes = walkCauses(e);
  if (causes.length) {
    console.error('Details:');
    causes.forEach((l) => console.error(' ', l));
  }
  console.error('');
  console.error(hintForNetwork(e));
  console.error('  • If URL is trycloudflare.com: tunnel must be running where the API runs.');
  console.error('  • Production API host example: legal-tech-system-q6to3.ondigitalocean.app');
  console.error('  • Open the same base URL in the browser; if it does not load, Node cannot reach it either.');
  console.error('');
  process.exit(1);
}

const status = res.status;
let hint = '';
if (status >= 500) hint = ' (server error 5xx)';
else if (status === 400 || status === 422) hint = ' (validation 4xx)';
else if (status === 401 || status === 403) hint = ' (unauthorized)';
else if (status >= 200 && status < 300) hint = ' (success)';

console.log('');
console.log('URL:   ', url);
console.log('Status:', status, hint);
const text = await res.text();
if (text) {
  console.log('Body:  ', text.length > 400 ? text.slice(0, 400) + '…' : text);
}
console.log('');
