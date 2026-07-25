import { NextRequest, NextResponse } from 'next/server'
import { getSecurityQuestion, verifySecurityAnswer } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

// GET /api/auth/forgot-password?username=xxx - الحصول على سؤال الأمان
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    if (!username) {
      return NextResponse.json({ error: 'اسم المستخدم مطلوب' }, { status: 400 })
    }

    const rate = checkRateLimit(`forgot-question:${getClientIp(req)}`, {
      limit: 10,
      windowMs: 5 * 60 * 1000,
    })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة جداً، حاول لاحقاً' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }

    const result = await getSecurityQuestion(username)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ question: result.question })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/auth/forgot-password - التحقق من الإجابة وتغيير كلمة المرور
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, answer, newPassword } = body

    const rate = checkRateLimit(`forgot-reset:${getClientIp(req)}:${username ?? ''}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    })
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'محاولات كثيرة جداً، حاول لاحقاً' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }

    if (!username || !answer || !newPassword) {
      return NextResponse.json(
        { error: 'اسم المستخدم وإجابة الأمان وكلمة المرور الجديدة مطلوبة' },
        { status: 400 }
      )
    }

    const result = await verifySecurityAnswer(username, answer, newPassword)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
