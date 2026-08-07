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

const TENANT_MODELS = [
  'factorySettings',
  'worker',
  'workerAdvance',
  'workerReceipt',
  'workerAttendance',
  'production',
  'customer',
  'supplier',
  'sale',
  'purchase',
  'expenseCategory',
  'expense',
  'treasuryTransaction',
  'warehouse',
  'material',
  'materialTransaction',
  'product',
  'productionOrder',
  'payment',
  'saleReturn',
  'purchaseReturn',
  'auditLog',
] as const

async function ensureUserCompany(user: {
  id: string
  companyId: string | null
  username: string
  name: string
  role: string
}): Promise<string> {
  const desiredCode = `user:${user.id}`
  const desiredName = `شركة ${user.name || user.username}`

  let company = await db.company.findUnique({ where: { code: desiredCode } })

  if (!company && user.companyId) {
    // حوّل الشركة الحالية إلى الشركة الثابتة للمستخدم لو لم تكن هناك شركة ثابتة أخرى
    company = await db.company.update({
      where: { id: user.companyId },
      data: { code: desiredCode, name: desiredName },
    }).catch(() => null)
  }

  if (!company) {
    company = await db.company.create({
      data: { name: desiredName, code: desiredCode },
    })
  }

  // لو المستخدم كان مرتبطاً بشركة أخرى مكررة، انقل بياناته إلى الشركة الثابتة ثم اربطه بها
  if (user.companyId && user.companyId !== company.id) {
    const oldCompanyId = user.companyId
    const otherUsers = await db.user.count({
      where: { companyId: oldCompanyId, NOT: { id: user.id } },
    })

    // لا ننقل شركة مشتركة مع مستخدمين آخرين
    if (otherUsers === 0) {
      const moves = TENANT_MODELS.map((model) =>
        (db as any)[model].updateMany({
          where: { companyId: oldCompanyId },
          data: { companyId: company.id },
        })
      )

      await db.$transaction([
        ...moves,
        db.user.update({
          where: { id: user.id },
          data: { companyId: company.id },
        }),
      ])
    } else {
      await db.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
      })
    }
  } else if (!user.companyId) {
    await db.user.update({
      where: { id: user.id },
      data: { companyId: company.id },
    })
  }

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

/**
 * Helper: يُرجع NextResponse خطأ من CompanyScopeResult
 */
export function scopeError(scope: CompanyScopeResult & { ok: false }) {
  const { NextResponse } = require('next/server')
  return NextResponse.json({ error: scope.error }, { status: scope.status })
}
