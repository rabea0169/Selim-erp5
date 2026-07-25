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

  const productions = await db.production.findMany({
    where,
    include: { worker: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ productions })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { workerId, date, modelName, quantity, unitPrice, notes } = body

  if (!workerId) {
    return jsonError('الموظف مطلوب')
  }
  if (!date) {
    return jsonError('التاريخ مطلوب')
  }
  if (!modelName?.trim()) {
    return jsonError('اسم الموديل مطلوب')
  }
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (isNaN(qty) || qty <= 0) {
    return jsonError('الكمية يجب أن تكون رقماً موجباً')
  }
  if (isNaN(price) || price < 0) {
    return jsonError('سعر القطعة يجب أن يكون رقماً موجباً')
  }

  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: auth.companyId } })
  if (!worker) {
    return notFound('الموظف غير موجود')
  }

  const production = await db.production.create({
    data: {
      workerId,
      date: new Date(date),
      modelName: modelName.trim(),
      quantity: qty,
      unitPrice: price,
      total: qty * price,
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
    include: { worker: true },
  })
  return NextResponse.json({ production })
})
