/**
 * معالجة آمنة للأخطاء — تُظهر الرسائل التوضيحية الصريحة للمستخدم وتُخفي التفاصيل التقنية المسربة في الإنتاج
 */

import { Prisma } from '@prisma/client'

// رسائل عامة للأخطاء التقنية بحسب الكود
const SAFE_MESSAGES: Record<number, string> = {
  400: 'بيانات غير صالحة',
  401: 'غير مصرح — يجب تسجيل الدخول أولاً',
  403: 'غير مصرح — صلاحيات غير كافية',
  404: 'المورد المطلوب غير موجود',
  409: 'تعارض في البيانات',
  500: 'حدث خطأ داخلي في الخادم',
}

/**
 * إنشاء رد خطأ آمن يُرجع الرسائل المخصصة الواضحة للمستخدم
 */
export function safeError(e: unknown, defaultStatus: number = 500): {
  error: string
  status: number
} {
  const isDev = process.env.NODE_ENV !== 'production'
  const rawMessage = e instanceof Error ? e.message : String(e)

  // تنظيف الرسالة من التفاف Prisma والتراسل الداخلي
  let cleanMessage = rawMessage
    .replace(/^Error:\s*/, '')
    .replace(/^Transaction failed:\s*/, '')
    .replace(/^Invalid `.*` invocation:\s*/, '')
    .replace(/Context:.*$/, '')
    .trim()

  // معرفة هل الخطأ تقني صريح خاص بقاعدة البيانات أو التوصيل
  const isTechnicalDbError =
    cleanMessage.includes('Prisma') ||
    cleanMessage.includes('Invocation') ||
    cleanMessage.includes('Unknown argument') ||
    cleanMessage.includes('connect ECONNREFUSED') ||
    cleanMessage.includes('postgresql://')

  // في الإنتاج، إذا كان الخطأ تقنياً وبحالة 500، نُخفي الاستاك ونُرجع الرسالة العامة
  if (!isDev && isTechnicalDbError && defaultStatus === 500) {
    return {
      error: SAFE_MESSAGES[500],
      status: 500,
    }
  }

  // إذا كان الخطأ تقنياً بحالة غير 500، نمرر رسالة مناسبة
  if (isTechnicalDbError) {
    cleanMessage = SAFE_MESSAGES[defaultStatus] || 'بيانات غير صالحة'
  }

  return { error: cleanMessage || 'حدث خطأ في النظام', status: defaultStatus }
}

/**
 * معرفة إن كان الخطأ Prisma unique constraint
 */
export function isUniqueConstraintError(e: any): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true
  if (typeof e?.message === 'string' && (
    e.message.includes('Unique constraint') ||
    e.message.includes('unique constraint')
  )) return true
  return false
}

/**
 * معرفة إن كان الخطأ Prisma not found
 */
export function isNotFoundError(e: any): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return true
  if (typeof e?.message === 'string' && (
    e.message.includes('Record to update') ||
    e.message.includes('Record to delete') ||
    e.message.includes('related record')
  )) return true
  return false
}
