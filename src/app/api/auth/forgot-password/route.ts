import { NextRequest, NextResponse } from 'next/server'
import { getSecurityQuestion, verifySecurityAnswer } from '@/lib/auth'

// GET /api/auth/forgot-password?username=xxx - الحصول على سؤال الأمان
export async function GET(req: NextRequest) {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/auth/forgot-password - التحقق من الإجابة وتغيير كلمة المرور
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, answer, newPassword } = body

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
