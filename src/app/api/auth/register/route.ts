import { NextRequest, NextResponse } from 'next/server'
import { registerUser, hasAnyUser } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { safeError } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting: 5 محاولات تسجيل في الدقيقة
    const ip = getClientIP(req)
    const { limited, retryAfter } = rateLimit(`register:${ip}`, 5, 60_000)
    if (limited) {
      return NextResponse.json(
        { error: `طلبات كثيرة جداً. حاول بعد ${retryAfter} ثانية` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const body = await req.json()
    const { username, password, name } = body

    if (!username || !password || !name) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    const result = await registerUser(username, password, name)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ user: result.user })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// التحقق من وجود مستخدمين (لاستخدامها في شاشة الدخول)
export async function GET() {
  try {
    const exists = await hasAnyUser()
    return NextResponse.json({ hasUsers: exists, registrationOpen: !exists })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
