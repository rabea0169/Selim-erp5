import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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
    return NextResponse.next()
  }

  // التحقق من الـ session cookie
  const sessionId = req.cookies.get('factory_session')?.value
  if (!sessionId) {
    return NextResponse.json(
      { error: 'غير مصرح — يجب تسجيل الدخول أولاً' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
