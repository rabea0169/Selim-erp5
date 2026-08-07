import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const existing = await db.workerReceipt.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'القبض غير موجود' }, { status: 404 })
    }
    await db.$transaction(async (tx) => {
      // حذف حركة الخزينة المرتبطة بالاستلام — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'worker_receipt', referenceId: id, companyId },
      })
      await tx.workerReceipt.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
