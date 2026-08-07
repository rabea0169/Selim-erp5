import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const body = await req.json()
    const { amount, date, categoryId, categoryName, notes } = body

    // فحص وجود المصروف وتبعيته للشركة (حماية IDOR)
    const existing = await db.expense.findFirst({
      where: { id, ...(user?.companyId ? { companyId: user.companyId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        amount: amt,
        date: date ? new Date(date) : existing.date,
        categoryId: categoryId || existing.categoryId,
        categoryName: categoryName || existing.categoryName,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
      },
    })
    return NextResponse.json({ expense })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    // فحص وجود المصروف وتبعيته للشركة (حماية IDOR)
    const expense = await db.expense.findFirst({
      where: { id, ...(user?.companyId ? { companyId: user.companyId } : {}) },
    })
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
