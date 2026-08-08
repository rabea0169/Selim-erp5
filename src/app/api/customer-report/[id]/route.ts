import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/customer-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const customer = await db.customer.findFirst({ where: { id, companyId } })
    if (!customer) return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const dateFilter = from || to ? { date: dateRange } : {}

    const [sales, returns, payments] = await Promise.all([
      db.sale.findMany({
        where: { customerId_ref: id, companyId, ...dateFilter },
        include: { items: true },
        orderBy: { date: 'desc' },
      }),
      db.saleReturn.findMany({
        where: { customerId_ref: id, companyId, ...dateFilter },
        orderBy: { date: 'desc' },
      }),
      db.payment.findMany({
        where: { customerId: id, type: 'customer_payment', companyId, ...dateFilter },
        orderBy: { date: 'desc' },
      }),
    ])

    const totalSales = sales.reduce((s: number, x: any) => s + x.total, 0)
    const totalReturns = returns.reduce((s: number, x: any) => s + x.total, 0)
    const totalPayments = payments.reduce((s: number, x: any) => s + x.amount, 0)
    const totalPaid = sales.reduce((s: number, x: any) => s + x.paid, 0)
    // fix(receivables): المدفوعات غير المرتبطة بفاتورة (سداد عام) لا تُحدِّث paid على أي فاتورة،
    // فيجب خصمها منفصلة من الرصيد — وإلا بقيت الذمة ظاهرة رغم تسجيل التحصيل.
    // المدفوعات المرتبطة بفاتورة محسوبة أصلاً ضمن totalPaid (تحدِّث sale.paid) فلا تُخصم مجدداً (منع الاحتساب المزدوج).
    const standalonePayments = payments.filter((p: any) => !p.invoiceId).reduce((s: number, x: any) => s + x.amount, 0)
    // الرصيد المتبقي = إجمالي المبيعات - المدفوع على الفواتير - المرتجعات - السدادات العامة
    const totalRemaining = totalSales - totalPaid - totalReturns - standalonePayments

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
        standalonePayments,
        totalRemaining: Math.max(0, totalRemaining),
      },
      sales,
      returns,
      payments,
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
