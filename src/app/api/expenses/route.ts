import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const categoryId = searchParams.get('categoryId')
    const q = searchParams.get('q') || ''

    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const where: any = user?.companyId ? { companyId: user.companyId } : {}
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
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { categoryId, amount, date, description, notes } = body

    if (!categoryId) {
      return NextResponse.json({ error: 'بند المصروف مطلوب' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }

    const expense = await db.$transaction(async (tx) => {
      const cat = await tx.expenseCategory.findFirst({
        where: { id: categoryId, ...(user?.companyId ? { companyId: user.companyId } : {}) },
      })
      if (!cat) {
        throw new Error('فئة المصروف غير موجودة')
      }

      const exp = await tx.expense.create({
        data: {
          companyId: user?.companyId || null,
          categoryId,
          categoryName: cat.name,
          amount: amt,
          date: new Date(date),
          notes: notes?.trim() || null,
        },
        include: { category: true },
      })

      await tx.treasuryTransaction.create({
        data: {
          companyId: user?.companyId || null,
          type: 'withdrawal',
          amount: amt,
          date: new Date(date),
          description: `مصروف: ${description || cat.name}`,
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
    if (e instanceof Error && e.message.includes('غير موجودة')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
