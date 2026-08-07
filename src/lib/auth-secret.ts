/**
 * auth-secret.ts — مفتاح تشفير وحيد وموحد للجلسات في التطبيق بالكامل
 */
export function getTokenSecret(): string {
  return (
    process.env.TOKEN_SECRET ||
    process.env.INVOICE_SECRET ||
    'selim-erp5-production-token-secret-key-2026'
  )
}
