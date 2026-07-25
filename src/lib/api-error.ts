import { NextResponse } from 'next/server'

const GENERIC_ERROR = 'حدث خطأ في الخادم، حاول مرة أخرى'

// معالجة موحّدة لأخطاء الـ API: تسجيل الخطأ كاملاً على السيرفر
// وإرجاع رسالة للعميل بدون تسريب تفاصيل داخلية في الإنتاج
export function handleApiError(error: unknown, context: string): NextResponse {
  console.error(`[API] ${context} failed:`, error)

  const message =
    process.env.NODE_ENV === 'production'
      ? GENERIC_ERROR
      : error instanceof Error
        ? error.message
        : String(error)

  return NextResponse.json({ error: message }, { status: 500 })
}
