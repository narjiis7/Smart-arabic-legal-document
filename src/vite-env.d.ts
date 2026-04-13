/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** true = لا باكند؛ واجهة فقط مع بيانات تجريبية */
  readonly VITE_FRONTEND_ONLY: string;
  readonly VITE_MOCK_AUTH: string;
  readonly VITE_EMAIL_LOGIN_PATH: string;
  readonly VITE_EMAIL_LOGIN_BODY: string;
  readonly VITE_LOGIN_PATH: string;
  /** POST ثانٍ بعد دخول البريد: مسار يصدر JWT لـ /api/mini/* (جسم email/password مثل الرئيسي) */
  readonly VITE_MINI_EMAIL_LOGIN_PATH: string;
  /** إن كان true: جرّب POST /api/mini/auth/login بنفس البريد وكلمة المرور بعد الدخول الرئيسي */
  readonly VITE_MINI_AUTH_WITH_EMAIL: string;
  /** مسار تجديد التوكن (افتراضي /api/mini/auth/refresh-token) */
  readonly VITE_MINI_REFRESH_PATH: string;
  /** جسم الطلب: فارغ = JSON نصي (Swagger)؛ object | camel | pascal */
  readonly VITE_MINI_REFRESH_BODY: string;
  /** false يعطّل إعادة المحاولة بعد 401 عبر refresh-token */
  readonly VITE_MINI_REFRESH_ON_401: string;
  /** POST إلغاء refresh (افتراضي /api/mini/auth/revoke-token) */
  readonly VITE_MINI_REVOKE_PATH: string;
  /** GET ملف المستخدم (افتراضي /api/mini/auth/profile) */
  readonly VITE_MINI_PROFILE_PATH: string;
  readonly VITE_API_PROXY_TARGET: string;
  readonly VITE_AI_BASE_URL: string;
  readonly VITE_AI_API_KEY: string;
  readonly VITE_AI_MODEL: string;
  readonly VITE_AI_MOCK: string;
  /** استشارة المساعد: openai = تجاهل الخادم واستخدام VITE_AI_* فقط؛ غير مضبوط = POST /api/mini/ai-chat عند وجود VITE_API_BASE_URL */
  readonly VITE_CONSULT_AI_SOURCE: string;
  /** جسم POST /api/mini/ai-chat: pascal = { Message } */
  readonly VITE_MINI_AI_CHAT_BODY: string;
  /** POST /api/mini/reviews: pascal = ConsultationRequestId, Rating, Comment */
  readonly VITE_MINI_REVIEW_BODY: string;
  /** PascalCase لـ POST generate (TemplateId, Data) ولـ send-for-signing (SecondPartyName, SecondPartyPhone) */
  readonly VITE_MINI_CONTRACT_GENERATE_BODY: string;
  /** GET محامي المستخدم (افتراضي /api/mini/me/assigned-lawyer) */
  readonly VITE_MINI_ASSIGNED_LAWYER_PATH: string;
  /** true = إظهار رابط لوحة تعيين المحامي بدون دور Admin (تطوير فقط) */
  readonly VITE_DEV_ADMIN_LAWYER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
