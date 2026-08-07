import { db } from '@/lib/db-server'
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

async function ensureUserCompany(user: {
  id: string
  companyId: string | null
  username: string
  name: string
  role: string
}): Promise<string> {
  if (user.companyId) return user.companyId

  // إصلاح تلقائي للحسابات القديمة التي أُنشئت قبل تعدد الشركات
  const company = await db.company.create({
    data: { name: `شركة ${user.name || user.username}` },
  })

  await db.user.update({
    where: { id: user.id },
    data: { companyId: company.id },
  })

  return company.id
}

/**
 * يفرض وجود جلسة مستخدم مرتبطة بشركة.
 * استخدمه في كل API يقرأ أو يكتب بيانات تشغيلية.
 */
export async function requireCompanyScope(): Promise<CompanyScopeResult> {
  const user = await getCurrentUser()

  if (!user) {
    return { ok: false, error: 'غير مصرح — يجب تسجيل الدخول أولاً', status: 401 }
  }

  try {
    const companyId = await ensureUserCompany(user)

    return {
      ok: true,
      companyId,
      user: {
        id: user.id,
        companyId,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    }
  } catch {
    return { ok: false, error: 'تعذر تجهيز شركة الحساب الحالي', status: 500 }
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
