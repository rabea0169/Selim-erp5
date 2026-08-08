/**
 * تنظيف النص من أكواد HTML لمنع XSS
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * التحقق من أن رابط صورة آمن للاستخدام في src:
 * يسمح فقط بروابط http/https أو data:image/* (شعارات مرفوعة base64)
 * ويرفض javascript:/data:text/html وغيرها — يعيد '' عند الرفض.
 */
export function safeImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  const u = url.trim()
  if (/^https?:\/\//i.test(u)) return u
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(u)) return u
  return ''
}
