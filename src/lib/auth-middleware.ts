import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { checkPermission } from '@/lib/permissions'

/**
 * Middleware للتحقق من الصلاحيات
 * يتحقق من أن المستخدم لديه الصلاحية المطلوبة للعملية
 */
export async function requirePermission(
  req: NextRequest,
  resource: string,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE'
) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) {
      return {
        ok: false,
        error: scope.error,
        status: scope.status,
      }
    }

    const userId = scope.user?.id
    if (!userId) {
      return {
        ok: false,
        error: 'غير مصرح - يجب تسجيل الدخول أولاً',
        status: 401,
      }
    }

    // التحقق من الصلاحيات
    const hasPermission = await checkPermission(userId, resource, action)
    
    if (!hasPermission) {
      return {
        ok: false,
        error: `ليس لديك صلاحية ${action} في ${resource}`,
        status: 403,
      }
    }

    return {
      ok: true,
      scope,
    }
  } catch (error: any) {
    return {
      ok: false,
      error: error.message || 'خطأ في التحقق من الصلاحيات',
      status: 500,
    }
  }
}

/**
 * دالة مساعدة للتحقق من الصلاحيات وإرجاع استجابة خطأ إذا لزم الأمر
 */
export async function checkAndRespond(
  req: NextRequest,
  resource: string,
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'APPROVE'
) {
  const result = await requirePermission(req, resource, action)
  
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    )
  }

  return result
}
