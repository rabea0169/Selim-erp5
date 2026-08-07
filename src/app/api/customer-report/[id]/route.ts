import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

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

    const [sales, returns, payments] = await Promise.all([
      db.sale.findMany({
        where: { customerId_ref: id, ...filter },
        include: { items: true },
        orderBy: { date: 'desc' },
      }),
      db.saleReturn.findMany({
        where: { customerId_ref: id, ...filter },
        orderBy: { date: 'desc' },
      }),
      db.payment.findMany({
        where: { partyId: id, type: 'customer_payment', ...filter },
        orderBy: { date: 'desc' },
      }),
    ])

    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalReturns = returns.reduce((s, x) => s + x.total, 0)
    const totalPayments = payments.reduce((s, x) => s + x.amount, 0)
    const totalPaid = sales.reduce((s, x) => s + x.paid, 0)
    // الرصيد المتبقي = إجمالي المبيعات - المدفوع (يشمل المدفوعات المستقلة) - إجمالي المرتجعات
    const totalRemaining = totalSales - totalPaid - totalReturns

    return NextResponse.json({
      customer,
      range: { from, to },
      summary: {
        salesCount: sales.length,
        returnsCount: returns.length,
        paymentsCount: payments.length,
        totalSales,
        totalReturns,
        totalPayments,
        totalPaid,
        totalRemaining: Math.max(0, totalRemaining),
      },
      sales,
      returns,
      payments,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
