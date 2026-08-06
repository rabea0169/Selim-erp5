import 'server-only'

/**
 * crypto.ts — توقيع رقمي للعمليات الحساسة
 * 
 * يستخدم Node.js crypto (Server-Side فقط — لا تستورد هذا الملف في Client Components)
 * المفتاح السري في INVOICE_SECRET env variable
 */
import { createHmac, timingSafeEqual } from 'crypto'

const SECRET = process.env.INVOICE_SECRET || 'default-secret-change-in-production'

/** نوع بيانات الفاتورة للتوقيع */
export interface InvoiceSignaturePayload {
  id: string
  invoiceNo?: string | null
  total: number
  date: string | Date
  companyId?: string | null
}

/**
 * ينشئ توقيع HMAC-SHA256 لفاتورة بعيداً عن العميل
 * @param payload بيانات الفاتورة
 * @returns hex string للتوقيع
 */
export function signInvoice(payload: InvoiceSignaturePayload): string {
  const canonicalStr = JSON.stringify({
    id: payload.id,
    invoiceNo: payload.invoiceNo ?? null,
    total: Number(payload.total).toFixed(2),
    date: payload.date instanceof Date ? payload.date.toISOString() : payload.date,
    companyId: payload.companyId ?? null,
  })
  return createHmac('sha256', SECRET).update(canonicalStr).digest('hex')
}

/**
 * يتحقق من صحة توقيع فاتورة
 * @param payload بيانات الفاتورة
 * @param signature التوقيع المخزّن في قاعدة البيانات
 * @returns true إذا كان التوقيع صحيحاً
 */
export function verifyInvoice(payload: InvoiceSignaturePayload, signature: string): boolean {
  try {
    const expected = signInvoice(payload)
    const expectedBuf = Buffer.from(expected)
    const sigBuf = Buffer.from(signature)
    if (expectedBuf.length !== sigBuf.length) return false
    return timingSafeEqual(expectedBuf, sigBuf)
  } catch {
    return false
  }
}

/**
 * ينشئ hash بسيط لكلمة مرور (SHA-256)
 * ملاحظة: للكلمات المرور استخدم bcrypt — هذا فقط للتحقق السريع من التكامل
 */
export function hashData(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex')
}
