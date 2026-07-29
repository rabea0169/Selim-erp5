import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

// 10 محاولات كل 15 دقيقة لكل IP
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    // Rate Limiting
    const ip = getClientIP(req)
    const rateLimitKey = `login:${ip}`
    const { allowed, remaining, resetAt } = checkRateLimit(
      rateLimitKey,
      MAX_LOGIN_ATTEMPTS,
      LOGIN_WINDOW_MS,
    )

    if (!allowed) {
      const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `تجاوزت عدد المحاولات المسموح بها. حاول مرة أخرى بعد ${Math.ceil(retryAfterSec / 60)} دقيقة` },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Remaining': '0',
          },
        },
      )
    }

    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 },
      )
    }

    const result = await loginUser(username, password)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        {
          status: 401,
          headers: { 'X-RateLimit-Remaining': String(remaining) },
        },
      )
    }

    return NextResponse.json({ user: result.user })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى' }, { status: 500 })
  }
}
