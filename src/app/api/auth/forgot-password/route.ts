import { NextRequest, NextResponse } from 'next/server'
import { getSecurityQuestion, verifySecurityAnswer } from '@/lib/auth'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

// 5 محاولات كل 30 دقيقة
const MAX_ATTEMPTS = 5
const WINDOW_MS = 30 * 60 * 1000

// GET /api/auth/forgot-password?username=xxx - الحصول على سؤال الأمان
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    const { allowed } = checkRateLimit(`forgot-get:${ip}`, 20, 15 * 60 * 1000)
    if (!allowed) {
      return NextResponse.json({ error: 'تجاوزت عدد المحاولات المسموح بها' }, { status: 429 })
    }

    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    if (!username) {
      return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 })
    }

    const result = await getSecurityQuestion(username)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ question: result.question })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى' }, { status: 500 })
  }
}

// POST /api/auth/forgot-password - التحقق من الإجابة وتغيير كلمة المرور
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    const body = await req.json()
    const { username } = body

    // Rate limit بناءً على IP واسم المستخدم معاً
    const rateLimitKey = `forgot-post:${ip}:${username ?? ''}`
    const { allowed, resetAt } = checkRateLimit(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS)
    if (!allowed) {
      const retryAfterSec = Math.ceil((resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: `تجاوزت عدد المحاولات. حاول مرة أخرى بعد ${Math.ceil(retryAfterSec / 60)} دقيقة` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      )
    }

    const { answer, newPassword } = body

    if (!username || !answer || !newPassword) {
      return NextResponse.json(
        { error: 'اسم المستخدم وإجابة الأمان وكلمة المرور الجديدة مطلوبة' },
        { status: 400 },
      )
    }

    const result = await verifySecurityAnswer(username, answer, newPassword)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم، يرجى المحاولة مرة أخرى' }, { status: 500 })
  }
}
