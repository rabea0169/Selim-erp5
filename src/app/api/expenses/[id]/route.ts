import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const expense = await db.expense.findFirst({ where: { id, companyId: auth.companyId } })
    if (!expense) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    // حذف المصروف يعكس أثره على الخزينة
    await db.$transaction(async (tx) => {
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'expense', referenceId: expense.id, companyId: auth.companyId },
      })
      await tx.expense.delete({ where: { id: expense.id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
