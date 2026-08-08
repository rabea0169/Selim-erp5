import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/supplier-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supplier = await db.supplier.findFirst({ where: { id, companyId } })
    if (!supplier) return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const dateFilter = from || to ? { date: dateRange } : {}

    const [purchases, returns, payments] = await Promise.all([
      db.purchase.findMany({
        where: { supplierId_ref: id, companyId, ...dateFilter },
        include: { items: true },
        orderBy: { date: 'desc' },
      }),
      db.purchaseReturn.findMany({
        where: { supplierId_ref: id, companyId, ...dateFilter },
        orderBy: { date: 'desc' },
      }),
      db.payment.findMany({
        where: { supplierId: id, type: 'supplier_payment', companyId, ...dateFilter },
        orderBy: { date: 'desc' },
      }),
    ])

    const totalPurchases = purchases.reduce((s: number, x: any) => s + x.total, 0)
    const totalReturns = returns.reduce((s: number, x: any) => s + x.total, 0)
    const totalPayments = payments.reduce((s: number, x: any) => s + x.amount, 0)
    const totalPaid = purchases.reduce((s: number, x: any) => s + x.paid, 0)
    // fix(receivables): السدادات العامة (بدون فاتورة) لا تُحدِّث paid على أي فاتورة شراء،
    // فيجب خصمها منفصلة من المستحق — والمرتبطة بفاتورة محسوبة ضمن totalPaid (منع الاحتساب المزدوج).
    const standalonePayments = payments.filter((p: any) => !p.invoiceId).reduce((s: number, x: any) => s + x.amount, 0)
    // الرصيد المتبقي = إجمالي المشتريات - المدفوع على الفواتير - المرتجعات - السدادات العامة
    const totalRemaining = totalPurchases - totalPaid - totalReturns - standalonePayments

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
        standalonePayments,
        totalRemaining: Math.max(0, totalRemaining),
      },
      purchases,
      returns,
      payments,
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
