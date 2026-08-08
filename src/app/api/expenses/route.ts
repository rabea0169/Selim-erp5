import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const categoryId = searchParams.get('categoryId')
    const q = searchParams.get('q') || ''

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const where: any = { companyId }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = fromDate
      if (to) {
        toDate!.setHours(23, 59, 59, 999)
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
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const body = await req.json()
    const { categoryId, amount, date, description, notes } = body

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

    // Fix C: Wrap in transaction with treasury withdrawal
    const expense = await db.$transaction(async (tx: any) => {
      // التحقق من وجود الفئة داخل نفس الشركة
      const cat = await tx.expenseCategory.findFirst({ where: { id: categoryId, companyId } })
      if (!cat) {
        throw new Error('فئة المصروف غير موجودة')
      }

      const newExpense = await tx.expense.create({
        data: {
          companyId,
          categoryId,
          categoryName: cat.name,
          amount: amt,
          date: new Date(date),
          notes: notes?.trim() || null,
        },
        include: { category: true },
      })

      // Create corresponding treasury withdrawal
      await tx.treasuryTransaction.create({
        data: {
          companyId,
          type: 'withdrawal',
          amount: amt,
          description: `مصروف: ${description || cat.name}`,
          referenceType: 'expense',
          referenceId: newExpense.id,
          date: newExpense.date,
        },
      })

      return newExpense
    })
    return NextResponse.json({ expense })
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجودة')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
