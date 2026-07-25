import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    const rate = checkRateLimit(`login:${getClientIp(req)}:${username ?? ''}`, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة جداً، حاول لاحقاً' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const result = await loginUser(username, password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ user: result.user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
