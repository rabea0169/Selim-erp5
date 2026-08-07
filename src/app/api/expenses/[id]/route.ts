import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { amount, date, categoryId, notes } = body

    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }

    // Fix Q: Date validation
    let dateObj: Date | undefined
    if (date) {
      dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
      }
    }

    // ذرّية كاملة: تحديث المصروف + مزامنة حركة الخزينة في معاملة واحدة
    const expense = await db.$transaction(async (tx) => {
      // فحص وجود المصروف وتبعيته للشركة (حماية IDOR) — الفلتر إجباري
      const existing = await tx.expense.findFirst({
        where: { id, companyId },
      })
      if (!existing) {
        throw new Error('المصروف غير موجود')
      }

      // عند تغيير الفئة: التحقق أنها تتبع نفس الشركة واشتقاق اسمها من قاعدة البيانات
      const newCategoryId = categoryId || existing.categoryId
      let categoryName = existing.categoryName
      if (newCategoryId !== existing.categoryId) {
        const cat = await tx.expenseCategory.findFirst({
          where: { id: newCategoryId, companyId },
        })
        if (!cat) {
          throw new Error('فئة المصروف غير موجودة')
        }
        categoryName = cat.name
      }

      const updated = await tx.expense.update({
        where: { id },
        data: {
          amount: amt,
          date: dateObj ?? existing.date,
          categoryId: newCategoryId,
          categoryName,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        },
        include: { category: true },
      })

      // مزامنة حركة الخزينة المرتبطة بهذا المصروف (المبلغ/التاريخ/الوصف)
      const linked = await tx.treasuryTransaction.findFirst({
        where: { referenceType: 'expense', referenceId: id, companyId },
      })
      if (linked) {
        await tx.treasuryTransaction.updateMany({
          where: { referenceType: 'expense', referenceId: id, companyId },
          data: {
            amount: amt,
            date: updated.date,
            description: `مصروف: ${categoryName}`,
          },
        })
      } else {
        // بيانات قديمة بلا حركة خزينة — أنشئ الحركة لضمان التزامن
        await tx.treasuryTransaction.create({
          data: {
            companyId,
            type: 'withdrawal',
            amount: amt,
            description: `مصروف: ${categoryName}`,
            referenceType: 'expense',
            referenceId: id,
            date: updated.date,
          },
        })
      }

      return updated
    })
    return NextResponse.json({ expense })
  } catch (e) {
    if (e instanceof Error && (e.message === 'المصروف غير موجود' || e.message === 'فئة المصروف غير موجودة')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params

    // فحص وجود المصروف وتبعيته للشركة (حماية IDOR)
    const expense = await db.expense.findFirst({
      where: { id, companyId },
    })
    if (!expense) {
      return NextResponse.json({ error: 'المصروف غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // حذف حركة الخزينة المرتبطة بهذا المصروف — داخل نفس الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'expense', referenceId: id, companyId },
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
