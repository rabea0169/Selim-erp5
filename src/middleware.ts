import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/session'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

/** يضيف security headers لكل الاستجابات */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

// Routes عامة لا تحتاج مصادقة
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/me',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // تجاوز الـ static files والـ Next.js internals
  if (
    !pathname.startsWith('/api/') ||
    pathname.startsWith('/api/_') ||
    PUBLIC_ROUTES.includes(pathname)
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Rate limiting عام لجميع الـ API endpoints: 200 طلب في الدقيقة
  const ip = getClientIP(req)
  const { limited, retryAfter } = rateLimit(`api:${ip}`, 200, 60_000)
  if (limited) {
    return addSecurityHeaders(NextResponse.json(
      { error: 'طلبات كثيرة جداً. حاول لاحقاً' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    ))
  }

  // توصية 5: التحقق من الـ session cookie
  const sessionCookie = req.cookies.get('factory_session')?.value
  const session = await verifySessionToken(sessionCookie)
  if (!session) {
    return addSecurityHeaders(NextResponse.json(
      { error: 'غير مصرح — يجب تسجيل الدخول أولاً' },
      { status: 401 }
    ))
  }

  // توصية 5: حماية العمليات الحساسة (admin/owner فقط)
  // backup, restore, sync, delete عمليات لا يمكن الوصول إليها إلا للمدير
  const sensitiveOps = [
    '/api/restore',
    '/api/sync/push',
    '/api/sync/pull',
    '/api/backup',
    '/api/seed',
  ]
  // All sync/backup operations require admin for any HTTP method
  if (sensitiveOps.some(p => pathname.startsWith(p))) {
    if (session.role !== 'admin' && session.role !== 'owner') {
      return addSecurityHeaders(NextResponse.json(
        { error: 'غير مصرح — يتطلب صلاحيات مدير' },
        { status: 403 }
      ))
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/api/:path*'],
}
