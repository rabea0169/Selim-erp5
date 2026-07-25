import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError, notFound } from '@/lib/api'

export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const workerId = searchParams.get('workerId')

  const where: any = withCompanyScope({}, auth.companyId)
  if (workerId) where.workerId = workerId
  if (from || to) {
    where.date = {}
    if (from) where.date.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      where.date.lte = toDate
    }
  }

  const receipts = await db.workerReceipt.findMany({
    where,
    include: { worker: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ receipts })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { workerId, amount, date, notes } = body

  if (!workerId) {
    return jsonError('الموظف مطلوب')
  }
  if (!date) {
    return jsonError('التاريخ مطلوب')
  }
  const amt = Number(amount)
  if (isNaN(amt) || amt <= 0) {
    return jsonError('المبلغ يجب أن يكون رقماً موجباً')
  }

  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: auth.companyId } })
  if (!worker) {
    return notFound('الموظف غير موجود')
  }

  const receipt = await db.workerReceipt.create({
    data: { workerId, amount: amt, date: new Date(date), notes: notes?.trim() || null },
    include: { worker: true },
  })
  return NextResponse.json({ receipt })
})
