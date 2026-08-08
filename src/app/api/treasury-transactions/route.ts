import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { validateData, treasuryTransactionSchema } from '@/lib/validations'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const category = searchParams.get('category')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(1000, Math.max(1, Number(searchParams.get('limit')) || 50))

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const where: any = { companyId }
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

    const [transactions, total, deposits, withdrawals] = await Promise.all([
      db.treasuryTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.treasuryTransaction.count({ where }),
      db.treasuryTransaction.aggregate({
        where: { ...where, type: 'deposit' },
        _sum: { amount: true },
      }),
      db.treasuryTransaction.aggregate({
        where: { ...where, type: 'withdrawal' },
        _sum: { amount: true },
      }),
    ])

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
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const body = await req.json()

    // Zod validation
    const validation = validateData(treasuryTransactionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
    }
    const { type, amount, date, description, category, notes } = validation.data

    const transaction = await db.treasuryTransaction.create({
      data: {
        companyId: scope.companyId,
        type,
        amount,
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
