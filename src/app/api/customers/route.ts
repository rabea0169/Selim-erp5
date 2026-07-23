import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
      ]
    }
    const customers = await db.customer.findMany({
      where,
      include: {
        _count: { select: { sales: true } },
        sales: {
          select: { total: true, paid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const withTotals = customers.map((c) => {
      const totalSales = c.sales.reduce((s, x) => s + x.total, 0)
      const totalPaid = c.sales.reduce((s, x) => s + x.paid, 0)
      return {
        ...c,
        totalSales,
        totalPaid,
        totalRemaining: totalSales - totalPaid,
        salesCount: c._count.sales,
        sales: undefined,
        _count: undefined,
      }
    })
    return NextResponse.json({ customers: withTotals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, notes } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    }
    const customer = await db.customer.create({
      data: { name, phone: phone || null, address: address || null, notes: notes || null },
    })
    return NextResponse.json({ customer })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
