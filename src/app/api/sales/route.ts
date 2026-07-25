import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError } from '@/lib/api'

// GET /api/sales?from=&to=&q=
export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
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
  if (q) {
    where.OR = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { invoiceNo: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ]
  }

  const sales = await db.sale.findMany({
    where,
    include: { items: true },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json({ sales })
})

// POST /api/sales
export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const {
    customerName,
    customerId_ref,
    invoiceNo,
    date,
    items,
    paid,
    notes,
  } = body

  if (!customerName?.trim()) {
    return jsonError('اسم العميل مطلوب')
  }
  if (!date) {
    return jsonError('التاريخ مطلوب')
  }
  if (!Array.isArray(items) || items.length === 0) {
    return jsonError('يجب إضافة صنف واحد على الأقل')
  }

  const validItems = items.filter(
    (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
  )
  if (validItems.length === 0) {
    return jsonError('أضف صنفاً صحيحاً واحداً على الأقل')
  }

  const total = validItems.reduce(
    (sum: number, it: any) => sum + Number(it.quantity) * Number(it.unitPrice),
    0
  )
  const paidAmount = Number(paid) || 0

  if (customerId_ref) {
    const customer = await db.customer.findFirst({
      where: { id: customerId_ref, companyId: auth.companyId },
    })
    if (!customer) {
      return jsonError('العميل المحدد غير موجود')
    }
  }

  const sale = await db.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        customerName: customerName.trim(),
        customerId_ref: customerId_ref || null,
        invoiceNo: invoiceNo?.trim() || null,
        date: new Date(date),
        total,
        paid: paidAmount,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
        items: {
          create: validItems.map((it: any) => ({
            itemName: it.itemName.trim(),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            total: Number(it.quantity) * Number(it.unitPrice),
          })),
        },
      },
      include: { items: true },
    })
    return newSale
  })

  return NextResponse.json({ sale })
})
