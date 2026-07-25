import { NextRequest, NextResponse } from 'next/server'
import { getSecurityQuestion, verifySecurityAnswer } from '@/lib/auth'
import { jsonError, serverError } from '@/lib/api'

// GET /api/auth/forgot-password?username=xxx - الحصول على سؤال الأمان
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    if (!username) {
      return jsonError('اسم المستخدم مطلوب')
    }

    const result = await getSecurityQuestion(username)
    if (!result.success) {
      return jsonError(result.error || '')
    }

    return NextResponse.json({ question: result.question })
  } catch (e) {
    return serverError(e)
  }
}

// POST /api/auth/forgot-password - التحقق من الإجابة وتغيير كلمة المرور
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, answer, newPassword } = body

    if (!username || !answer || !newPassword) {
      return jsonError('اسم المستخدم وإجابة الأمان وكلمة المرور الجديدة مطلوبة')
    }

    const result = await verifySecurityAnswer(username, answer, newPassword)
    if (!result.success) {
      return jsonError(result.error || '')
    }

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (e) {
    return serverError(e)
  }
}
