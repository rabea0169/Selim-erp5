import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth, withCompanyScope } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const categoryId = searchParams.get('categoryId')
    const q = searchParams.get('q') || ''

    const where: any = withCompanyScope({}, auth.companyId)
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { categoryId, amount, date, notes } = body

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

    const cat = await db.expenseCategory.findFirst({ where: { id: categoryId, companyId: auth.companyId } })
    if (!cat) {
      return NextResponse.json({ error: 'فئة المصروف غير موجودة' }, { status: 404 })
    }

    const expense = await db.expense.create({
      data: {
        categoryId,
        categoryName: cat.name,
        amount: amt,
        date: new Date(date),
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
      include: { category: true },
    })
    return NextResponse.json({ expense })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
