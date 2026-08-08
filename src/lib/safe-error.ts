/**
 * معالجة آمنة للأخطاء — تحافظ على الرسائل الموجهة للمستخدم باللغة العربية مع إخفاء أخطاء النظام التقنية في الإنتاج
 */

import { Prisma } from '@prisma/client'

// رسائل عامة لكل HTTP status
const SAFE_MESSAGES: Record<number, string> = {
  400: 'بيانات غير صالحة',
  401: 'غير مصرح — يجب تسجيل الدخول أولاً',
  403: 'غير مصرح — صلاحيات غير كافية',
  404: 'المورد المطلوب غير موجود',
  409: 'تعارض في البيانات',
  500: 'حدث خطأ داخلي في الخادم',
}

/**
 * إنشاء رد خطأ آمن — يُظهر الرسائل العربية التوضيحية للمستخدم ويُخفي الأخطاء التقنية في الإنتاج
 */
export function safeError(e: unknown, defaultStatus: number = 500): {
  error: string
  status: number
} {
  const isDev = process.env.NODE_ENV !== 'production'
  const rawMessage = e instanceof Error ? e.message : String(e)

  // تنظيف الرسالة من التفاف Prisma والتراسل الداخلي
  const cleanMessage = rawMessage
    .replace(/^Error:\s*/, '')
    .replace(/^Transaction failed:\s*/, '')
    .replace(/^Invalid `.*` invocation:\s*/, '')
    .replace(/Context:.*$/, '')
    .trim()

  // إذا كانت الرسالة باللغة العربية (رسالة مخصصة للمستخدم)، نُظهرها حتى في الإنتاج
  const isUserFriendly =
    /[\u0600-\u06FF]/.test(cleanMessage) &&
    !cleanMessage.includes('Prisma') &&
    !cleanMessage.includes('Transaction') &&
    !cleanMessage.includes('Invocation') &&
    !cleanMessage.includes('Unknown argument')

  if (!isDev && !isUserFriendly) {
    return {
      error: SAFE_MESSAGES[defaultStatus] || SAFE_MESSAGES[500],
      status: defaultStatus,
    }
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
