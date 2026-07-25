import { NextResponse } from 'next/server'
import { getCurrentUser, ServerUser } from './auth'
import { hasPermission, PermissionAction } from './permissions'

// ====== نتيجة التحقق (server-only) ======
export type AuthContext = { authorized: true; user: ServerUser; companyId: string }
export type AuthFailure = { authorized: false; response: NextResponse }
export type AuthResult = AuthContext | AuthFailure

// ====== Middleware: التحقق من تسجيل الدخول + الصلاحية (server-only) ======
export async function requireAuth(action: PermissionAction = 'read'): Promise<AuthResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 }),
    }
  }

  if (!hasPermission(user.role, action)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'ليس لديك صلاحية لهذا الإجراء' }, { status: 403 }),
    }
  }

  return {
    authorized: true,
    user,
    companyId: user.companyId,
  }
}
