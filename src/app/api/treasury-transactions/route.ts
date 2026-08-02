import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const category = searchParams.get('category')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const where: any = {}
    if (type) where.type = type
    if (category) where.category = category
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = fromDate
      if (to) {
        toDate!.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const [transactions, total, summaryResult] = await Promise.all([
      db.treasuryTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.treasuryTransaction.count({ where }),
      db.treasuryTransaction.aggregate({
        where,
        _sum: {
          amount: true,
        },
      }),
    ])

    const deposits = await db.treasuryTransaction.aggregate({
      where: { ...where, type: 'deposit' },
      _sum: { amount: true },
    })
    const withdrawals = await db.treasuryTransaction.aggregate({
      where: { ...where, type: 'withdrawal' },
      _sum: { amount: true },
    })

    const totalDeposits = deposits._sum.amount || 0
    const totalWithdrawals = withdrawals._sum.amount || 0
    const balance = totalDeposits - totalWithdrawals

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalDeposits,
        totalWithdrawals,
        balance,
      },
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, amount, date, description, category, notes } = body

    if (!type || !['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json(
        { error: 'النوع يجب أن يكون إيداع أو سحب' },
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
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }
    if (!description?.trim()) {
      return NextResponse.json(
        { error: 'الوصف مطلوب' },
        { status: 400 }
      )
    }

    const transaction = await db.treasuryTransaction.create({
      data: {
        type,
        amount: amt,
        date: new Date(date),
        description: description.trim(),
        category: category?.trim() || null,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ transaction })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
