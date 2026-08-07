import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// أسماء ودية لأنواع المراجع — تُستخدم في رسالة المنع
const REFERENCE_LABELS: Record<string, string> = {
  expense: 'مصروف',
  payment: 'سداد',
  sale: 'فاتورة مبيعات',
  purchase: 'فاتورة مشتريات',
  sale_return: 'مرتجع مبيعات',
  purchase_return: 'مرتجع مشتريات',
  worker_advance: 'سلفة عامل',
  worker_receipt: 'استلام عامل',
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params

    // فحص وجود الحركة وتبعيتها للشركة (حماية IDOR)
    const tx = await db.treasuryTransaction.findFirst({
      where: { id, companyId },
    })
    if (!tx) {
      return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
    }

    // منع حذف أي حركة مرتبطة بمستند آخر (مصروف/سداد/بيع/شراء/مرتجع/سلفة/استلام)
    // — تُحذف تلقائياً عند حذف المستند الأصلي حفاظاً على الترابط المحاسبي
    if (tx.referenceId && tx.referenceType) {
      const label = REFERENCE_LABELS[tx.referenceType] || 'مستند آخر'
      return NextResponse.json(
        { error: `هذه الحركة مرتبطة بـ${label} — احذفها من شاشتها الأصلية` },
        { status: 400 }
      )
    }

    await db.treasuryTransaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
