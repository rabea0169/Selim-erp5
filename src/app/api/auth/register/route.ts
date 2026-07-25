import { NextRequest, NextResponse } from 'next/server'
import { registerUser, addUserToCompany, hasAnyUser } from '@/lib/auth'
import { requireAuth } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password, name, companyName, phone, securityQuestion, securityAnswer } = body

    // إذا لم يكن هناك مستخدمين، أنشئ شركة جديدة
    const anyUser = await hasAnyUser()
    if (!anyUser) {
      if (!companyName?.trim()) {
        return NextResponse.json({ error: 'اسم الشركة مطلوب للتسجيل الأول' }, { status: 400 })
      }
      const result = await registerUser(username, password, name, companyName, phone, securityQuestion, securityAnswer)
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ user: result.user })
    }

    // يوجد مستخدمون — يجب أن يكون مسجلاً الدخول بصلاحية manageUsers
    const auth = await requireAuth('manageUsers')
    if (!auth.authorized) return auth.response

    const result = await addUserToCompany(
      username,
      password,
      name,
      body.role || 'employee',
      auth.companyId,
      phone,
      securityQuestion,
      securityAnswer,
    )
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ user: result.user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// التحقق من وجود مستخدمين
export async function GET() {
  try {
    const exists = await hasAnyUser()
    return NextResponse.json({ hasUsers: exists })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
