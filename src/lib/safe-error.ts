/**
 * معالجة آمنة للأخطاء — لا يكشف تفاصيل داخلية للعميل
 */

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
export function isUniqueConstraintError(e: unknown): boolean {
	const msg = e instanceof Error ? e.message : ''
	return msg.includes('Unique constraint') || msg.includes('unique constraint')
}

/**
 * معرفة إن كان الخطأ Prisma not found
 */
export function isNotFoundError(e: unknown): boolean {
	const msg = e instanceof Error ? e.message : ''
	return msg.includes('Record to update') || msg.includes('Record to delete') ||
		msg.includes('No record found')
}
