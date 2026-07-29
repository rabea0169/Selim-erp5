import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/supplier-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supplier = await db.supplier.findUnique({ where: { id } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const filter = from || to ? { date: dateRange } : {}

    const [purchases, returns, payments] = await Promise.all([
      db.purchase.findMany({
        where: { supplierId_ref: id, ...filter },
        include: { items: true },
        orderBy: { date: 'desc' },
      }),
      db.purchaseReturn.findMany({
        where: { supplierId_ref: id, ...filter },
        orderBy: { date: 'desc' },
      }),
      db.payment.findMany({
        where: { partyId: id, type: 'supplier_payment', ...filter },
        orderBy: { date: 'desc' },
      }),
    ])

    const totalPurchases = purchases.reduce((s, x) => s + x.total, 0)
    const totalReturns = returns.reduce((s, x) => s + x.total, 0)
    const totalPayments = payments.reduce((s, x) => s + x.amount, 0)
    const totalPaid = purchases.reduce((s, x) => s + x.paid, 0)
    // الرصيد المتبقي = إجمالي المشتريات - المدفوع على الفواتير - المدفوعات المستقلة - إجمالي المرتجعات
    const totalRemaining = totalPurchases - totalPaid - totalPayments - totalReturns

    return NextResponse.json({
      supplier,
      range: { from, to },
      summary: {
        purchasesCount: purchases.length,
        returnsCount: returns.length,
        paymentsCount: payments.length,
        totalPurchases,
        totalReturns,
        totalPayments,
        totalPaid,
        totalRemaining: Math.max(0, totalRemaining),
      },
      purchases,
      returns,
      payments,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
