import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/reports?from=&to=
// returns aggregated totals for all transaction types in the date range
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      dateRange.lte = toDate
    }

    const dateFilter = from || to ? { date: dateRange } : {}

    // Sales totals
    const sales = await db.sale.findMany({
      where: dateFilter,
      include: { items: true },
      orderBy: { date: 'desc' },
    })
    const salesTotal = sales.reduce((s, x) => s + x.total, 0)
    const salesPaid = sales.reduce((s, x) => s + x.paid, 0)
    const salesRemaining = salesTotal - salesPaid

    // Purchases totals
    const purchases = await db.purchase.findMany({
      where: dateFilter,
      include: { items: true },
      orderBy: { date: 'desc' },
    })
    const purchasesTotal = purchases.reduce((s, x) => s + x.total, 0)
    const purchasesPaid = purchases.reduce((s, x) => s + x.paid, 0)
    const purchasesRemaining = purchasesTotal - purchasesPaid

    // Worker advances
    const advances = await db.workerAdvance.findMany({
      where: dateFilter,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })
    const advancesTotal = advances.reduce((s, x) => s + x.amount, 0)

    // Worker receipts
    const receipts = await db.workerReceipt.findMany({
      where: dateFilter,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })
    const receiptsTotal = receipts.reduce((s, x) => s + x.amount, 0)

    // Worker production (piece-rate)
    const productions = await db.production.findMany({
      where: dateFilter,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })
    const productionTotal = productions.reduce((s, x) => s + x.total, 0)
    const productionPieces = productions.reduce((s, x) => s + x.quantity, 0)

    // Worker attendance
    const attendance = await db.workerAttendance.findMany({
      where: dateFilter,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    // Expenses
    const expenses = await db.expense.findMany({
      where: dateFilter,
      include: { category: true },
      orderBy: { date: 'desc' },
    })
    const expensesTotal = expenses.reduce((s, x) => s + x.amount, 0)

    // Expenses grouped by category
    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      const key = e.categoryName
      expensesByCategory[key] = (expensesByCategory[key] || 0) + e.amount
    }

    // Top selling items
    const itemAgg: Record<string, { qty: number; total: number }> = {}
    for (const s of sales) {
      for (const it of s.items) {
        if (!itemAgg[it.itemName]) itemAgg[it.itemName] = { qty: 0, total: 0 }
        itemAgg[it.itemName].qty += it.quantity
        itemAgg[it.itemName].total += it.total
      }
    }
    const topItems = Object.entries(itemAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Production by model
    const prodByModel: Record<string, { qty: number; total: number }> = {}
    for (const p of productions) {
      if (!prodByModel[p.modelName]) prodByModel[p.modelName] = { qty: 0, total: 0 }
      prodByModel[p.modelName].qty += p.quantity
      prodByModel[p.modelName].total += p.total
    }
    const topModels = Object.entries(prodByModel)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Net calculation
    // الإنتاج بالقطعة يُعتبر مصروف لأنه يستحق للموظف
    const netProfit =
      salesTotal - purchasesTotal - expensesTotal - advancesTotal + receiptsTotal - productionTotal

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
      sales,
      purchases,
      advances,
      receipts,
      productions,
      attendance,
      expenses,
      expensesByCategory,
      topItems,
      topModels,
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
