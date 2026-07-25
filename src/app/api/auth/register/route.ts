import { NextRequest, NextResponse } from 'next/server'
import { registerUser, addUserToCompany, hasAnyUser, getCurrentUser } from '@/lib/auth'
import { requireAuth } from '@/lib/require-auth'
import { jsonError, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password, name, companyName, phone, securityQuestion, securityAnswer } = body

    // إذا لم يكن هناك مستخدمين، أنشئ شركة جديدة
    const anyUser = await hasAnyUser()
    if (!anyUser) {
      // التسجيل الأول: إنشاء شركة + مستخدم owner
      if (!companyName?.trim()) {
        return jsonError('اسم الشركة مطلوب للتسجيل الأول')
      }
      const result = await registerUser(username, password, name, companyName, phone, securityQuestion, securityAnswer)
      if (!result.success) {
        return jsonError(result.error || '')
      }
      return NextResponse.json({ user: result.user })
    }

    // إذا يوجد مستخدمين، يجب أن يكون مسجلاً الدخول بـ owner/admin
    const auth = await requireAuth('manageUsers')
    if (!auth.authorized) {
      return auth.response
    }

    // التحقق من أن المستخدم لديه صلاحية إدارة المستخدمين
    if (!hasPermission(auth.user.role, 'manageUsers')) {
      return jsonError('ليس لديك صلاحية لإضافة مستخدمين', 403)
    }

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
      return jsonError(result.error || '')
    }

    return NextResponse.json({ user: result.user })
  } catch (e) {
    return serverError(e)
  }
}

// التحقق من وجود مستخدمين
export async function GET() {
  try {
    const exists = await hasAnyUser()
    return NextResponse.json({ hasUsers: exists })
  } catch (e) {
    return serverError(e)
  }
}
