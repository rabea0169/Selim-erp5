import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError } from '@/lib/api'

// GET /api/treasury?from=&to=&type=&page=&limit=
export const GET = withAuth('read', async ({ auth, req }) => {
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
})

// POST /api/treasury
export const POST = withAuth('create', async ({ auth, req }) => {
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
    return jsonError('نوع العملية مطلوب')
  }
  if (!amount || Number(amount) <= 0) {
    return jsonError('المبلغ مطلوب ويجب أن يكون أكبر من صفر')
  }
  if (!date) {
    return jsonError('التاريخ مطلوب')
  }
  if (!description?.trim()) {
    return jsonError('الوصف مطلوب')
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
})
