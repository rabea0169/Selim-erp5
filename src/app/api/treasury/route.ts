import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/treasury?from=&to=&type=&page=&limit=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

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
    if (type) {
      where.type = type
    }

    const [transactions, total] = await Promise.all([
      db.treasuryTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.treasuryTransaction.count({ where }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST /api/treasury
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const {
      type,
      amount,
      date,
      description,
      category,
      referenceType,
      referenceId,
      notes,
    } = body

    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع العملية مطلوب' }, { status: 400 })
    }
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'المبلغ مطلوب ويجب أن يكون أكبر من صفر' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    if (!description?.trim()) {
      return NextResponse.json({ error: 'الوصف مطلوب' }, { status: 400 })
    }

    const transaction = await db.treasuryTransaction.create({
      data: {
        type: type.trim(),
        amount: Number(amount),
        date: new Date(date),
        description: description.trim(),
        category: category?.trim() || null,
        referenceType: referenceType?.trim() || null,
        referenceId: referenceId?.trim() || null,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
    })

    return NextResponse.json({ transaction })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
