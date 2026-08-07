import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/reports?from=&to=
// uses Prisma aggregation to avoid loading all records into memory (PERF fix)
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const cid = scope.companyId
    const dateRange: any = {}
    if (from) dateRange.gte = fromDate
    if (to) {
      toDate!.setHours(23, 59, 59, 999)
      dateRange.lte = toDate
    }

    const dateFilter = from || to ? { date: dateRange } : {}
    const scopeFilter = { companyId: cid, ...dateFilter }

    // Sales aggregation (PERF fix: aggregate instead of loading all)
    const salesAgg = await db.sale.aggregate({
      where: scopeFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const salesTotal = salesAgg._sum.total || 0
    const salesPaid = salesAgg._sum.paid || 0
    const salesRemaining = salesTotal - salesPaid

    // Purchases aggregation
    const purchasesAgg = await db.purchase.aggregate({
      where: scopeFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const purchasesTotal = purchasesAgg._sum.total || 0
    const purchasesPaid = purchasesAgg._sum.paid || 0
    const purchasesRemaining = purchasesTotal - purchasesPaid

    // Worker advances aggregation
    const advancesAgg = await db.workerAdvance.aggregate({
      where: scopeFilter,
      _sum: { amount: true },
      _count: true,
    })
    const advancesTotal = advancesAgg._sum.amount || 0

    // Worker receipts aggregation
    const receiptsAgg = await db.workerReceipt.aggregate({
      where: scopeFilter,
      _sum: { amount: true },
      _count: true,
    })
    const receiptsTotal = receiptsAgg._sum.amount || 0

    // Worker production aggregation
    const productionAgg = await db.production.aggregate({
      where: scopeFilter,
      _sum: { total: true, quantity: true },
      _count: true,
    })
    const productionTotal = productionAgg._sum.total || 0
    const productionPieces = productionAgg._sum.quantity || 0

    // Worker attendance count
    const attendanceCount = await db.workerAttendance.count({ where: dateFilter })

    // Expenses aggregation
    const expensesAgg = await db.expense.aggregate({
      where: scopeFilter,
      _sum: { amount: true },
      _count: true,
    })
    const expensesTotal = expensesAgg._sum.amount || 0

    // Sale returns aggregation (money refunded to customers)
    const saleReturnsAgg = await db.saleReturn.aggregate({
      where: scopeFilter,
      _sum: { total: true },
      _count: true,
    })
    const saleReturnsTotal = saleReturnsAgg._sum.total || 0

    // Purchase returns aggregation (money recovered from suppliers)
    const purchaseReturnsAgg = await db.purchaseReturn.aggregate({
      where: scopeFilter,
      _sum: { total: true },
      _count: true,
    })
    const purchaseReturnsTotal = purchaseReturnsAgg._sum.total || 0

    // Expenses grouped by category (efficient groupBy)
    const expensesByCategoryRaw = await db.expense.groupBy({
      by: ['categoryName'],
      where: scopeFilter,
      _sum: { amount: true },
    })
    const expensesByCategory: Record<string, number> = {}
    for (const e of expensesByCategoryRaw) {
      expensesByCategory[e.categoryName || 'غير مصنف'] = e._sum.amount || 0
    }

    // Top selling items (using groupBy on saleItem with sale date filter)
    const saleIds = await db.sale.findMany({
      where: scopeFilter,
      select: { id: true },
    })
    const saleIdSet = saleIds.map(s => s.id)

    const topItemsRaw = saleIdSet.length > 0
      ? await db.saleItem.groupBy({
          by: ['itemName'],
          where: { saleId: { in: saleIdSet } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        })
      : []
    const topItems = topItemsRaw.map(r => ({
      name: r.itemName,
      qty: r._sum.quantity || 0,
      total: r._sum.total || 0,
    }))

    // Production by model (efficient groupBy)
    const topModelsRaw = await db.production.groupBy({
      by: ['modelName'],
      where: scopeFilter,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })
    const topModels = topModelsRaw.map(r => ({
      name: r.modelName,
      qty: r._sum.quantity || 0,
      total: r._sum.total || 0,
    }))

    // صافي الربح = (مبيعات - مرتجعات مبيعات) - (مشتريات - مرتجعات مشتريات) - مصروفات - تكلفة الإنتاج (أجور القطعة)
    const netProfit =
      (salesTotal - saleReturnsTotal) - (purchasesTotal - purchaseReturnsTotal) - expensesTotal - productionTotal

    return NextResponse.json({
      range: { from, to },
      summary: {
        salesTotal,
        salesPaid,
        salesRemaining,
        purchasesTotal,
        purchasesPaid,
        purchasesRemaining,
        advancesTotal,
        receiptsTotal,
        productionTotal,
        productionPieces,
        expensesTotal,
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
