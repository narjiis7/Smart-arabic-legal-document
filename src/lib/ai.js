import { isApiConfigured, miniAiChat } from './api.js';

/**
 * ربط موديل AI عبر واجهة OpenAI-compatible (الأغلبية تدعمها):
 * - OpenAI: VITE_AI_BASE_URL=https://api.openai.com/v1
 * - Groq:   VITE_AI_BASE_URL=https://api.groq.com/openai/v1
 * - OpenRouter: VITE_AI_BASE_URL=https://openrouter.ai/api/v1
 * - LM Studio محلي: VITE_AI_BASE_URL=http://localhost:1234/v1
 *
 * VITE_AI_API_KEY = المفتاح (تحذير: يظهر في المتصفح — للإنتاج استخدم باكند يخفي المفتاح)
 * VITE_AI_MODEL = اسم الموديل عند المزود
 * VITE_AI_MOCK=true لإجبار رد وهمي بدون استدعاء شبكة
 */

const LEGAL_SYSTEM_AR = `أنت مساعد قانوني إجرائي. مهمتك توضيح الخطوات الإجرائية والأوراق المطلوبة بشكل عام — بدون تقديم استشارة قانونية ملزمة أو حكم نهائي على القضية.

أجب بالعربية بهذا الهيكل قدر الإمكان:
1. الأوراق والمستمسكات المطلوبة تقريباً
2. الجهات أو الجهة المناسبة للتوجه
3. خطوات إجرائية مقترحة بالترتيب
4. تنويه أن هذا دليل إرشادي فقط وليس بديلاً عن محامٍ`;

function aiBaseUrl() {
  const u = import.meta.env.VITE_AI_BASE_URL;
  if (typeof u === 'string' && u.trim()) return u.trim().replace(/\/$/, '');
  return 'https://api.openai.com/v1';
}

function useMock() {
  return import.meta.env.VITE_AI_MOCK === 'true';
}

function hasKey() {
  const k = import.meta.env.VITE_AI_API_KEY;
  return typeof k === 'string' && k.trim().length > 0;
}

/**
 * @param {{ problem: string; category: string; urgency: 'normal' | 'urgent' }} p
 * @returns {Promise<string>}
 */
export async function askLegalAssistant({ problem, category, urgency }) {
  const priorityAr = urgency === 'urgent' ? 'عاجل' : 'عادي';
  const userContent = `نوع الخدمة المختار: ${category}
أولوية الطلب: ${priorityAr}

وصف المشكلة:
${problem}`;

  if (useMock()) {
    await new Promise((r) => setTimeout(r, 900));
    return [
      'رد تجريبي (VITE_AI_MOCK=true):',
      '',
      '1. الأوراق: هوية، مستندات ذات صلة بالمشكلة.',
      '2. الجهة: الجهة المختصة حسب نوع القضية في بلدك.',
      '3. الخطوات: توثيق الحقائق → استشارة محامٍ → المتابعة الرسمية.',
      '4. هذا توجيه عام وليس استشارة قانونية.',
    ].join('\n');
  }

  /** باكند LegalTech: POST /api/mini/ai-chat + JWT — عند ضبط عنوان الـ API (ما لم يُضبط VITE_CONSULT_AI_SOURCE=openai) */
  const useMiniBackend =
    isApiConfigured() && import.meta.env.VITE_CONSULT_AI_SOURCE !== 'openai';

  if (useMiniBackend) {
    const data = await miniAiChat({ message: userContent });
    const text = data.reply || '';
    if (!text.trim()) {
      throw new Error('الخادم لم يُرجع نصاً في حقل reply');
    }
    return text.trim();
  }

  if (!hasKey()) {
    await new Promise((r) => setTimeout(r, 900));
    return [
      '⚠️ لا يوجد VITE_AI_API_KEY في .env — هذا رد تجريبي.',
      'أضف المفتاح والموديل لربط OpenAI أو Groq أو OpenRouter أو LM Studio.',
      '',
      '1. المستندات: هوية، عقود أو مراسلات تخص النزاع.',
      '2. الجهة: حسب نوع القضية (محكمة، جهة إدارية، وسيط…).',
      '3. الخطوات: حصر الأدلة → مراجعة مختص → الطلب الرسمي.',
      '4. تنبيه: هذا مثال وليس استشارة قانونية.',
    ].join('\n');
  }

  const model = import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini';
  const key = import.meta.env.VITE_AI_API_KEY.trim();
  const url = `${aiBaseUrl()}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: LEGAL_SYSTEM_AR },
        { role: 'user', content: userContent },
      ],
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('شكل الرد غير متوقع من الموديل');
  }
  return text.trim();
}
