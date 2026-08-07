import { NextRequest, NextResponse } from 'next/server'
import { registerUser, hasAnyUser } from '@/lib/auth'
import { db } from '@/lib/db-server'
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

// حذف جميع المستخدمين لإعادة فتح التسجيل (محمي بـ RESET_KEY)
export async function DELETE(req: NextRequest) {
  try {
    const expectedKey = process.env.RESET_KEY
    if (!expectedKey) {
      return NextResponse.json(
        { error: 'خاصية إعادة التعيين غير مفعّلة' },
        { status: 403 }
      )
    }

    // يدعم المفتاح من query param أو header
    const urlKey = req.nextUrl.searchParams.get('resetKey')
    const headerKey = req.headers.get('x-reset-key')
    const resetKey = urlKey || headerKey

    if (resetKey !== expectedKey) {
      return NextResponse.json(
        { error: 'مفتاح إعادة التعيين غير صحيح' },
        { status: 403 }
      )
    }

    const count = await db.user.count()
    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'لا يوجد مستخدمين — التسجيل مفتوح بالفعل',
        deletedCount: 0,
      })
    }

    await db.user.deleteMany()

    return NextResponse.json({
      success: true,
      message: `تم حذف ${count} مستخدم. التسجيل مفتوح الآن.`,
      deletedCount: count,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
