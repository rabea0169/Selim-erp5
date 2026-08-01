import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const categoryId = searchParams.get('categoryId')
    const q = searchParams.get('q') || ''

    const where: any = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    if (categoryId) where.categoryId = categoryId
    if (q) where.notes = { contains: q }

    const expenses = await db.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ expenses })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { categoryId, amount, date, notes } = body

    // التحقق من البيانات
    if (!categoryId) {
      return NextResponse.json(
        { error: 'بند المصروف مطلوب' },
        { status: 400 }
      )
    }
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }
    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون رقماً موجباً' },
        { status: 400 }
      )
    }

    // التحقق من وجود الفئة
    const cat = await db.expenseCategory.findUnique({ where: { id: categoryId } })
    if (!cat) {
      return NextResponse.json(
        { error: 'فئة المصروف غير موجودة' },
        { status: 404 }
      )
    }

    const expense = await db.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          categoryId,
          categoryName: cat.name, // تخزين اسم الفئة لسرعة العرض
          amount: amt,
          date: new Date(date),
          notes: notes?.trim() || null,
        },
        include: { category: true },
      })

      // إنشاء حركة سحب في الخزينة للمصروف
      await tx.treasuryTransaction.create({
        data: {
          type: 'withdrawal',
          amount: amt,
          date: new Date(date),
          description: `مصروف: ${cat.name}`,
          category: 'مصاريف',
          referenceType: 'expense',
          referenceId: exp.id,
          notes: notes?.trim() || null,
        },
      })

      return exp
    })
    return NextResponse.json({ expense })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
