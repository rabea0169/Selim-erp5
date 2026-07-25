import { NextResponse } from 'next/server'
import { getCurrentUser } from './auth'
import { hasPermission } from './permissions'

// ====== Middleware: التحقق من تسجيل الدخول + الصلاحية (server-only) ======
export async function requireAuth(action: 'create' | 'read' | 'update' | 'delete' | 'manageUsers' | 'manageSettings' | 'backup' = 'read') {
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
