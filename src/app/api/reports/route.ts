import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/reports?from=&to=
// uses Prisma aggregation to avoid loading all records into memory (PERF fix)
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Fix Q: Date validation
    // إصلاح المناطق الزمنية: التواريخ تُخزَّن كـ new Date('YYYY-MM-DD') = منتصف الليل UTC،
    // لذلك تُفلتر بنوافذ UTC صريحة بدلاً من setHours (التي تعتمد على منطقة السيرفر الزمنية)
    const parseBoundary = (value: string, endOfDay: boolean): Date => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
      if (m) {
        const y = Number(m[1])
        const mo = Number(m[2]) - 1
        const d = Number(m[3])
        return endOfDay
          ? new Date(Date.UTC(y, mo, d, 23, 59, 59, 999))
          : new Date(Date.UTC(y, mo, d, 0, 0, 0, 0))
      }
      const dt = new Date(value)
      if (endOfDay && !isNaN(dt.getTime())) dt.setUTCHours(23, 59, 59, 999)
      return dt
    }

    const fromDate = from ? parseBoundary(from, false) : undefined
    const toDate = to ? parseBoundary(to, true) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const dateRange: any = {}
    if (from) dateRange.gte = fromDate
    if (to) dateRange.lte = toDate

    // عزل الشركات: كل التجميعات مقيدة بشركة المستخدم
    const dateFilter: any = { companyId }
    if (from || to) dateFilter.date = dateRange

    // Sales aggregation (PERF fix: aggregate instead of loading all)
    const salesAgg = await db.sale.aggregate({
      where: dateFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const salesTotal = salesAgg._sum.total || 0
    const salesPaid = salesAgg._sum.paid || 0
    const salesRemaining = salesTotal - salesPaid
    const salesCount = salesAgg._count || 0

    // Purchases aggregation
    const purchasesAgg = await db.purchase.aggregate({
      where: dateFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const purchasesTotal = purchasesAgg._sum.total || 0
    const purchasesPaid = purchasesAgg._sum.paid || 0
    const purchasesRemaining = purchasesTotal - purchasesPaid
    const purchasesCount = purchasesAgg._count || 0

    // Worker advances aggregation
    const advancesAgg = await db.workerAdvance.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const advancesTotal = advancesAgg._sum.amount || 0
    const advancesCount = advancesAgg._count || 0

    // Worker receipts aggregation
    const receiptsAgg = await db.workerReceipt.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const receiptsTotal = receiptsAgg._sum.amount || 0
    const receiptsCount = receiptsAgg._count || 0

    // Worker production aggregation
    const productionAgg = await db.production.aggregate({
      where: dateFilter,
      _sum: { total: true, quantity: true },
      _count: true,
    })
    const productionTotal = productionAgg._sum.total || 0
    const productionPieces = productionAgg._sum.quantity || 0
    const productionCount = productionAgg._count || 0

    // Worker attendance count
    const attendanceCount = await db.workerAttendance.count({ where: dateFilter })

    // Expenses aggregation
    const expensesAgg = await db.expense.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const expensesTotal = expensesAgg._sum.amount || 0
    const expensesCount = expensesAgg._count || 0

    // Sale returns aggregation (money refunded to customers)
    const saleReturnsAgg = await db.saleReturn.aggregate({
      where: dateFilter,
      _sum: { total: true },
      _count: true,
    })
    const saleReturnsTotal = saleReturnsAgg._sum.total || 0

    // Purchase returns aggregation (money recovered from suppliers)
    const purchaseReturnsAgg = await db.purchaseReturn.aggregate({
      where: dateFilter,
      _sum: { total: true },
      _count: true,
    })
    const purchaseReturnsTotal = purchaseReturnsAgg._sum.total || 0

    // Expenses grouped by category (efficient groupBy)
    const expensesByCategoryRaw = await db.expense.groupBy({
      by: ['categoryName'],
      where: dateFilter,
      _sum: { amount: true },
    })
    const expensesByCategory: Record<string, number> = {}
    for (const e of expensesByCategoryRaw) {
      expensesByCategory[e.categoryName || 'غير مصنف'] = e._sum.amount || 0
    }

    // Top selling items — groupBy على SaleItem مع فلتر عبر علاقة الفاتورة
    // (بدون تحميل كل الـ IDs في الذاكرة — إصلاح مشكلة حد الـ parameters عند كبر البيانات)
    const saleItemFilter: any = { sale: { companyId } }
    if (from || to) saleItemFilter.sale.date = dateRange

    const topItemsRaw = await db.saleItem.groupBy({
      by: ['itemName'],
      where: saleItemFilter,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })
    const topItems = topItemsRaw.map((r: any) => ({
      name: r.itemName,
      qty: r._sum.quantity || 0,
      total: r._sum.total || 0,
    }))

    // Production by model (efficient groupBy)
    const topModelsRaw = await db.production.groupBy({
      by: ['modelName'],
      where: dateFilter,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })
    const topModels = topModelsRaw.map((r: any) => ({
      name: r.modelName,
      qty: r._sum.quantity || 0,
      total: r._sum.total || 0,
    }))

    // Net profit: (sales - saleReturns) - (purchases - purchaseReturns) - expenses
    // Advances and receipts are internal worker transfers, production is internal valuation
    const netProfit =
      (salesTotal - saleReturnsTotal) - (purchasesTotal - purchaseReturnsTotal) - expensesTotal

    return NextResponse.json({
      range: { from, to },
      summary: {
        salesTotal,
        salesPaid,
        salesRemaining,
        salesCount,
        purchasesTotal,
        purchasesPaid,
        purchasesRemaining,
        purchasesCount,
        advancesTotal,
        advancesCount,
        receiptsTotal,
        receiptsCount,
        productionTotal,
        productionPieces,
        productionCount,
        attendanceCount,
        expensesTotal,
        expensesCount,
        saleReturnsTotal,
        purchaseReturnsTotal,
        netProfit,
      },
      expensesByCategory,
      topItems,
      topModels,
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
