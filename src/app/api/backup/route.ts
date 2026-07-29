import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

// GET /api/backup
export async function GET() {
  try {
    const auth = await requireAuth('backup')
    if (!auth.authorized) return auth.response

    const cid = auth.companyId

    const [
      workers, advances, receipts, attendance, production,
      customers, suppliers,
      sales, purchases,
      expenseCategories, expenses,
      treasuryTransactions,
      warehouses, materials, materialTransactions,
      products, productionOrders,
      payments, saleReturns, purchaseReturns,
    ] = await Promise.all([
      // ====== جداول بدون companyId مباشرة — تُفلتر عبر workerId ======
      db.worker.findMany({ where: { companyId: cid } }),
      db.workerAdvance.findMany({ where: { worker: { companyId: cid } } }),
      db.workerReceipt.findMany({ where: { worker: { companyId: cid } } }),
      db.workerAttendance.findMany({ where: { worker: { companyId: cid } } }),
      db.production.findMany({ where: { worker: { companyId: cid } } }),

      // ====== جداول لها companyId ======
      db.customer.findMany({ where: { companyId: cid } }),
      db.supplier.findMany({ where: { companyId: cid } }),
      db.sale.findMany({ where: { companyId: cid }, include: { items: true } }),
      db.purchase.findMany({ where: { companyId: cid }, include: { items: true } }),
      db.expenseCategory.findMany({ where: { companyId: cid } }),
      db.expense.findMany({ where: { companyId: cid } }),
      db.treasuryTransaction.findMany({ where: { companyId: cid } }),
      db.warehouse.findMany({ where: { companyId: cid } }),
      db.material.findMany({ where: { companyId: cid } }),
      db.materialTransaction.findMany({ where: { companyId: cid } }),
      db.product.findMany({ where: { companyId: cid } }),
      db.productionOrder.findMany({ where: { companyId: cid } }),
      db.payment.findMany({ where: { companyId: cid } }),
      db.saleReturn.findMany({ where: { companyId: cid } }),
      db.purchaseReturn.findMany({ where: { companyId: cid } }),
    ])

    // فصل items من sales وpurchases
    const saleItems = sales.flatMap((s: any) => s.items)
    const purchaseItems = purchases.flatMap((p: any) => p.items)
    const salesClean = sales.map(({ items: _i, ...s }: any) => s)
    const purchasesClean = purchases.map(({ items: _i, ...p }: any) => p)

    const backup = {
      version: 3,
      app: 'selim-erp',
      exportedAt: new Date().toISOString(),
      companyId: cid,
      data: {
        workers, workerAdvances: advances, workerReceipts: receipts,
        workerAttendance: attendance, production,
        customers, suppliers,
        sales: salesClean, saleItems,
        purchases: purchasesClean, purchaseItems,
        expenseCategories, expenses,
        treasuryTransactions,
        warehouses, materials, materialTransactions,
        products, productionOrders,
        payments, saleReturns, purchaseReturns,
      },
    }

    return NextResponse.json(backup, {
      headers: {
        'Content-Disposition': `attachment; filename="selim-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
