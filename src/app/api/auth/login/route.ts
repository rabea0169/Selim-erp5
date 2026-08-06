import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { safeError } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 محاولات دخول في 15 دقيقة لكل IP
    const ip = getClientIP(req)
    const { limited, retryAfter } = rateLimit(`login:${ip}`, 5, 15 * 60_000)
    if (limited) {
      return NextResponse.json(
        { error: `محاولات كثيرة جداً. حاول بعد ${retryAfter} ثانية` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    // Rate limiting: 5 محاولات لكل اسم مستخدم في 15 دقيقة
    const { limited: userLimited } = rateLimit(`login-user:${username.toLowerCase()}`, 5, 15 * 60_000)
    if (userLimited) {
      return NextResponse.json(
        { error: `محاولات كثيرة جداً. حاول بعد ${retryAfter} ثانية` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const result = await loginUser(username, password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ user: result.user })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
