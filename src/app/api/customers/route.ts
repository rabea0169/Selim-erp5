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
      { address: { contains: q, mode: 'insensitive' } },
    ]
  }
  const customers = await db.customer.findMany({
    where,
    include: {
      _count: { select: { sales: true } },
      sales: { select: { total: true, paid: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  const withTotals = customers.map((c) => {
    const totalSales = c.sales.reduce((s, x) => s + x.total, 0)
    const totalPaid = c.sales.reduce((s, x) => s + x.paid, 0)
    return {
      id: c.id, name: c.name, phone: c.phone, address: c.address,
      notes: c.notes, createdAt: c.createdAt,
      totalSales, totalPaid, totalRemaining: totalSales - totalPaid,
      salesCount: c._count.sales,
    }
  })
  return NextResponse.json({ customers: withTotals })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { name, phone, address, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم العميل مطلوب')
  }

  const customer = await db.customer.create({
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
  })
  return NextResponse.json({ customer })
})
