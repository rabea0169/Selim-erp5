/**
 * auth-secret.ts — مفتاح تشفير وحيد وموحد للجلسات في التطبيق بالكامل
 *
 * SECURITY: لا يوجد أي مفتاح إنتاج ثابت داخل الكود.
 * - في الإنتاج: TOKEN_SECRET إجباري، وإلا يفشل التشغيل (fail-closed).
 * - في التطوير فقط: fallback موحّد معروف لتسهيل العمل المحلي.
 */
const DEV_FALLBACK_SECRET = 'dev-only-fallback-secret-never-use-in-production'

export function getTokenSecret(): string {
  const secret = process.env.TOKEN_SECRET || process.env.INVOICE_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('TOKEN_SECRET environment variable is required in production')
  }
  return DEV_FALLBACK_SECRET
}
