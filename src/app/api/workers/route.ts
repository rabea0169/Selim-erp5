import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError } from '@/lib/api'

export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  const where: any = withCompanyScope({}, auth.companyId)
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { job: { contains: q, mode: 'insensitive' } },
    ]
  }

  const workers = await db.worker.findMany({
    where,
    include: {
      advances: { orderBy: { date: 'desc' } },
      receipts: { orderBy: { date: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const workersWithTotals = workers.map((w) => {
    const totalAdvances = w.advances.reduce((s, a) => s + a.amount, 0)
    const totalReceipts = w.receipts.reduce((s, r) => s + r.amount, 0)
    return {
      ...w,
      totalAdvances,
      totalReceipts,
      balance: totalAdvances - totalReceipts,
    }
  })

  return NextResponse.json({ workers: workersWithTotals })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { name, phone, job, type, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم الموظف مطلوب')
  }

  const validType = type === 'production' ? 'production' : 'monthly'

  const worker = await db.worker.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      job: job?.trim() || null,
      type: validType,
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
  })
  return NextResponse.json({ worker })
})
