import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/reports?from=&to=
// uses Prisma aggregation to avoid loading all records into memory (PERF fix)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const dateRange: any = {}
    if (from) dateRange.gte = fromDate
    if (to) {
      toDate!.setHours(23, 59, 59, 999)
      dateRange.lte = toDate
    }

    const dateFilter = from || to ? { date: dateRange } : {}

    // Sales aggregation (PERF fix: aggregate instead of loading all)
    const salesAgg = await db.sale.aggregate({
      where: dateFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const salesTotal = salesAgg._sum.total || 0
    const salesPaid = salesAgg._sum.paid || 0
    const salesRemaining = salesTotal - salesPaid

    // Purchases aggregation
    const purchasesAgg = await db.purchase.aggregate({
      where: dateFilter,
      _sum: { total: true, paid: true },
      _count: true,
    })
    const purchasesTotal = purchasesAgg._sum.total || 0
    const purchasesPaid = purchasesAgg._sum.paid || 0
    const purchasesRemaining = purchasesTotal - purchasesPaid

    // Worker advances aggregation
    const advancesAgg = await db.workerAdvance.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const advancesTotal = advancesAgg._sum.amount || 0

    // Worker receipts aggregation
    const receiptsAgg = await db.workerReceipt.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const receiptsTotal = receiptsAgg._sum.amount || 0

    // Worker production aggregation
    const productionAgg = await db.production.aggregate({
      where: dateFilter,
      _sum: { total: true, quantity: true },
      _count: true,
    })
    const productionTotal = productionAgg._sum.total || 0
    const productionPieces = productionAgg._sum.quantity || 0

    // Worker attendance count
    const attendanceCount = await db.workerAttendance.count({ where: dateFilter })

    // Expenses aggregation
    const expensesAgg = await db.expense.aggregate({
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    })
    const expensesTotal = expensesAgg._sum.amount || 0

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

    // Top selling items (using groupBy on saleItem with sale date filter)
    const saleIds = await db.sale.findMany({
      where: dateFilter,
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
      where: dateFilter,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })
    const topModels = topModelsRaw.map(r => ({
      name: r.modelName,
      qty: r._sum.quantity || 0,
      total: r._sum.total || 0,
    }))

    // Net calculation (الإيرادات - المشتريات - المصاريف العمومية)
    // ملاحظة: السلف والقبوضات هي تحويلات مالية داخلية تؤثر على الخزينة ولا تؤثر على الربح
    const netProfit = salesTotal - purchasesTotal - expensesTotal

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
