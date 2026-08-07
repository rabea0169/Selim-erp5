import { getCurrentUser } from '@/lib/auth'

export type CompanyScopedUser = {
  id: string
  companyId: string
  username: string
  name: string
  role: string
}

export type CompanyScopeResult =
  | { ok: true; companyId: string; user: CompanyScopedUser }
  | { ok: false; error: string; status: number }

/**
 * يفرض وجود جلسة مستخدم مرتبطة بشركة.
 * استخدمه في كل API يقرأ أو يكتب بيانات تشغيلية.
 */
export async function requireCompanyScope(): Promise<CompanyScopeResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { ok: false, error: 'غير مصرح — يجب تسجيل الدخول أولاً', status: 401 }
  }

  if (!user.companyId) {
    return { ok: false, error: 'الحساب غير مرتبط بشركة', status: 403 }
  }

  return {
    ok: true,
    companyId: user.companyId,
    user: {
      id: user.id,
      companyId: user.companyId,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  }
}

/**
 * مثل requireCompanyScope لكن يتطلب صلاحيات مدير داخل نفس الشركة فقط.
 */
export async function requireCompanyAdmin(): Promise<CompanyScopeResult> {
  const scope = await requireCompanyScope()
  if (!scope.ok) return scope

  if (scope.user.role !== 'admin') {
    return { ok: false, error: 'غير مصرح — يتطلب صلاحيات مدير داخل الشركة', status: 403 }
  }

  return scope
}
