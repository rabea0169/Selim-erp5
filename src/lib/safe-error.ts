/**
 * معالجة آمنة للأخطاء — لا يكشف تفاصيل داخلية للعميل
 */

import { Prisma } from '@prisma/client'


// رسائل عامة لكل HTTP status
const SAFE_MESSAGES: Record<number, string> = {
        400: 'بيانات غير صالحة',
        401: 'غير مصرح',
        403: 'غير مصرح',
        404: 'المورد غير موجود',
        409: 'تعارض في البيانات',
        500: 'حدث خطأ داخلي في الخادم',
}

/**
 * إنشاء رد خطأ آمن — لا يكشف e.message في الإنتاج
 */
export function safeError(e: unknown, defaultStatus: number = 500): {
        error: string
        status: number
} {
        const isDev = process.env.NODE_ENV !== 'production'
        const message = e instanceof Error ? e.message : String(e)

        // في الإنتاج نُرجع رسالة عامة فقط
        if (!isDev) {
                return {
                        error: SAFE_MESSAGES[defaultStatus] || SAFE_MESSAGES[500],
                        status: defaultStatus,
                }
        }

        // في التطوير نُرجع الرسالة الفعلية
        return { error: message, status: defaultStatus }
}

/**
 * معرفة إن كان الخطأ Prisma unique constraint
 */
export function isUniqueConstraintError(e: any): boolean {
        if (e?.code === 'P2002') return true
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
        if (e?.code === 'P2025') return true
        if (typeof e?.message === 'string' && e.message.includes('Record to update')) return true
        return false
}
