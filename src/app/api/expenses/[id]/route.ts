import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amount, date, categoryId, categoryName, notes } = body

    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }

    const expense = await db.$transaction(async (tx) => {
      const exp = await tx.expense.update({
        where: { id },
        data: {
          amount: amt,
          date: date ? new Date(date) : existing.date,
          categoryId: categoryId || existing.categoryId,
          categoryName: categoryName || existing.categoryName,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        },
      })
      // تحديث حركة الخزينة المرتبطة بهذا المصروف
      await tx.treasuryTransaction.updateMany({
        where: { referenceType: 'expense', referenceId: id },
        data: {
          amount: amt,
          date: date ? new Date(date) : existing.date,
          description: `مصروف: ${exp.categoryName}`,
        },
      })
      return exp
    })
    return NextResponse.json({ expense })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // حذف حركة الخزينة المرتبطة بهذا المصروف
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'expense', referenceId: id },
      })
      // حذف المصروف
      await tx.expense.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
