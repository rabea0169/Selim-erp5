import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params
    const existing = await db.workerAdvance.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'السلفة غير موجودة' }, { status: 404 })
    }
    await db.$transaction(async (tx: any) => {
      // حذف حركة الخزينة المرتبطة بالسلفة — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'worker_advance', referenceId: id, companyId },
      })
      await tx.workerAdvance.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
