import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth'

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
  const sessionCookie = req.cookies.get('factory_session')?.value
  const session = verifySessionToken(sessionCookie)
  if (!session) {
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
