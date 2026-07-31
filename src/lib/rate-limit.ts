/**
 * Rate Limiter بسيط في الذاكرة لتقييد الطلبات
 * يستخدم Map مع cleanup تلقائي
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// تنظيف دوري كل دقيقة
let cleanupTimer: ReturnType<typeof setInterval> | null = null
if (typeof globalThis !== 'undefined' && typeof globalThis.setTimeout === 'function') {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 60_000)
  // عدم منع exit في tests
  if (cleanupTimer.unref) cleanupTimer.unref()
}

/**
 * التحقق من rate limit
 * @param key مفتاح التقييد (مثلاً IP أو IP+endpoint)
 * @param maxRequests الحد الأقصى للطلبات
 * @param windowMs نافذة الوقت بالمللي ثانية
 * @returns { limited: boolean, retryAfter: number }
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): { limited: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > maxRequests) {
    return {
      limited: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  return { limited: false, retryAfter: 0 }
}

/**
 * الحصول على IP العميل من الطلب
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()
  return 'unknown'
}
