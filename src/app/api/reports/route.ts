import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { Prisma } from '@prisma/client'

// GET /api/reports?from=&to=
// uses Prisma aggregation to avoid loading all records into memory (PERF fix)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')

    // تحقق من صحة التاريخ
    const fromDate = from ? new Date(from) : undefined
    const toDate   = to   ? new Date(to)   : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to   && isNaN(toDate!.getTime()))  return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const dateRange: Prisma.DateTimeFilter = {}
    if (from) dateRange.gte = fromDate
    if (to) {
      toDate!.setHours(23, 59, 59, 999)
      dateRange.lte = toDate
    }

    // فلتر الشركة (عزل متعدد المستأجرين)
    const companyFilter: Prisma.SaleWhereInput = user?.companyId ? { companyId: user.companyId } : {}
    const dateFilter: Record<string, Prisma.DateTimeFilter> = from || to ? { date: dateRange } : {}
    const combinedFilter = { ...companyFilter, ...dateFilter }

    // ===== Aggregations بدلاً من تحميل كل السجلات =====

    const [salesAgg, purchasesAgg, advancesAgg, receiptsAgg, productionAgg, attendanceCount, expensesAgg] =
      await Promise.all([
        db.sale.aggregate({
          where: combinedFilter as Prisma.SaleWhereInput,
          _sum: { total: true, paid: true },
          _count: true,
        }),
        db.purchase.aggregate({
          where: combinedFilter as Prisma.PurchaseWhereInput,
          _sum: { total: true, paid: true },
          _count: true,
        }),
        db.workerAdvance.aggregate({
          where: { ...(user?.companyId ? { companyId: user.companyId } : {}), ...dateFilter } as Prisma.WorkerAdvanceWhereInput,
          _sum: { amount: true },
          _count: true,
        }),
        db.workerReceipt.aggregate({
          where: { ...(user?.companyId ? { companyId: user.companyId } : {}), ...dateFilter } as Prisma.WorkerReceiptWhereInput,
          _sum: { amount: true },
          _count: true,
        }),
        db.production.aggregate({
          where: { ...(user?.companyId ? { companyId: user.companyId } : {}), ...dateFilter } as Prisma.ProductionWhereInput,
          _sum: { total: true, quantity: true },
          _count: true,
        }),
        db.workerAttendance.count({
          where: { ...(user?.companyId ? { companyId: user.companyId } : {}), ...dateFilter } as Prisma.WorkerAttendanceWhereInput,
        }),
        db.expense.aggregate({
          where: combinedFilter as Prisma.ExpenseWhereInput,
          _sum: { amount: true },
          _count: true,
        }),
      ])

    const salesTotal       = salesAgg._sum.total      || 0
    const salesPaid        = salesAgg._sum.paid       || 0
    const salesRemaining   = salesTotal - salesPaid
    const purchasesTotal   = purchasesAgg._sum.total  || 0
    const purchasesPaid    = purchasesAgg._sum.paid   || 0
    const purchasesRemaining = purchasesTotal - purchasesPaid
    const advancesTotal    = advancesAgg._sum.amount  || 0
    const receiptsTotal    = receiptsAgg._sum.amount  || 0
    const productionTotal  = productionAgg._sum.total || 0
    const productionPieces = productionAgg._sum.quantity || 0
    const expensesTotal    = expensesAgg._sum.amount  || 0

    // مصاريف مجمّعة حسب الفئة
    const expensesByCategoryRaw = await db.expense.groupBy({
      by: ['categoryName'],
      where: combinedFilter as Prisma.ExpenseWhereInput,
      _sum: { amount: true },
    })
    const expensesByCategory: Record<string, number> = {}
    for (const e of expensesByCategoryRaw) {
      expensesByCategory[e.categoryName || 'غير مصنف'] = e._sum.amount || 0
    }

    // أكثر المنتجات مبيعاً (عبر sale IDs للشركة فقط)
    const saleIds = await db.sale.findMany({
      where: combinedFilter as Prisma.SaleWhereInput,
      select: { id: true },
    })
    const saleIdSet = saleIds.map((s) => s.id)

    const topItemsRaw = saleIdSet.length > 0
      ? await db.saleItem.groupBy({
          by: ['itemName'],
          where: { saleId: { in: saleIdSet } },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        })
      : []
    const topItems = topItemsRaw.map((r) => ({
      name:  r.itemName,
      qty:   r._sum.quantity || 0,
      total: r._sum.total    || 0,
    }))

    // أكثر الموديلات إنتاجاً
    const topModelsRaw = await db.production.groupBy({
      by: ['modelName'],
      where: { ...(user?.companyId ? { companyId: user.companyId } : {}), ...dateFilter } as Prisma.ProductionWhereInput,
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
    })
    const topModels = topModelsRaw.map((r) => ({
      name:  r.modelName,
      qty:   r._sum.quantity || 0,
      total: r._sum.total    || 0,
    }))

    // صافي الربح = المبيعات - المشتريات - المصاريف
    const netProfit = salesTotal - purchasesTotal - expensesTotal

    return NextResponse.json({
      range: { from, to },
      summary: {
        salesTotal, salesPaid, salesRemaining,
        purchasesTotal, purchasesPaid, purchasesRemaining,
        advancesTotal, receiptsTotal,
        productionTotal, productionPieces,
        expensesTotal, attendanceCount,
        netProfit,
      },
      expensesByCategory,
      topItems,
      topModels,
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
