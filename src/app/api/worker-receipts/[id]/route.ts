import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.workerReceipt.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'القبض غير موجود' }, { status: 404 })
    }
    await db.$transaction(async (tx) => {
      // حذف حركة الخزينة المرتبطة بهذا القبض
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'worker_receipt', referenceId: id },
      })
      // حذف القبض
      await tx.workerReceipt.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
