import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { handleApiError } from '@/lib/api-error'

// GET /api/customer-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const customer = await db.customer.findUnique({ where: { id } })
    if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const filter = from || to ? { date: dateRange } : {}

    const sales = await db.sale.findMany({
      where: { customerId_ref: id, ...filter },
      include: { items: true },
      orderBy: { date: 'desc' },
    })

    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalPaid = sales.reduce((s, x) => s + x.paid, 0)
    const totalRemaining = totalSales - totalPaid

    return NextResponse.json({
      customer,
      range: { from, to },
      summary: {
        salesCount: sales.length,
        totalSales,
        totalPaid,
        totalRemaining,
      },
      sales,
    })
  } catch (e) {
    return handleApiError(e, 'GET /api/customer-report/[id]')
  }
}
