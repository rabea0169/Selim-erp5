import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// GET /api/backup - تصدير بيانات الشركة الحالية فقط بصيغة JSON (admin فقط)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null

    // Fix: عزل كامل بالشركة — الجداول الفرعية (saleItems/purchaseItems) عبر معرفات الآباء
    const sales = await db.sale.findMany({ where: { companyId } })
    const purchases = await db.purchase.findMany({ where: { companyId } })
    const saleIds = sales.map((s) => s.id)
    const purchaseIds = purchases.map((p) => p.id)

    const [
      workers,
      advances,
      receipts,
      attendance,
      production,
      customers,
      suppliers,
      saleItems,
      purchaseItems,
      expenseCategories,
      expenses,
      products,
      warehouses,
      materials,
      materialTransactions,
      treasuryTransactions,
      productionOrders,
      payments,
      saleReturns,
      purchaseReturns,
      factorySettings,
      auditLogs,
    ] = await Promise.all([
      db.worker.findMany({ where: { companyId } }),
      db.workerAdvance.findMany({ where: { companyId } }),
      db.workerReceipt.findMany({ where: { companyId } }),
      db.workerAttendance.findMany({ where: { companyId } }),
      db.production.findMany({ where: { companyId } }),
      db.customer.findMany({ where: { companyId } }),
      db.supplier.findMany({ where: { companyId } }),
      db.saleItem.findMany({ where: { saleId: { in: saleIds } } }),
      db.purchaseItem.findMany({ where: { purchaseId: { in: purchaseIds } } }),
      db.expenseCategory.findMany({ where: { companyId } }),
      db.expense.findMany({ where: { companyId } }),
      db.product.findMany({ where: { companyId } }),
      db.warehouse.findMany({ where: { companyId } }),
      db.material.findMany({ where: { companyId } }),
      db.materialTransaction.findMany({ where: { companyId } }),
      db.treasuryTransaction.findMany({ where: { companyId } }),
      db.productionOrder.findMany({ where: { companyId } }),
      db.payment.findMany({ where: { companyId } }),
      db.saleReturn.findMany({ where: { companyId } }),
      db.purchaseReturn.findMany({ where: { companyId } }),
      db.factorySettings.findMany({ where: { companyId: companyId ?? '__none__' } }),
      db.auditLog.findMany({ where: { companyId } }),
    ])

    const backup = {
      version: 4,
      app: 'clothing-factory-management',
      companyId,
      exportedAt: new Date().toISOString(),
      data: {
        workers,
        workerAdvances: advances,
        workerReceipts: receipts,
        workerAttendance: attendance,
        production,
        customers,
        suppliers,
        sales,
        saleItems,
        purchases,
        purchaseItems,
        expenseCategories,
        expenses,
        products,
        warehouses,
        materials,
        materialTransactions,
        treasuryTransactions,
        productionOrders,
        payments,
        saleReturns,
        purchaseReturns,
        factorySettings,
        auditLogs,
      },
    }

    return NextResponse.json(backup, {
      headers: {
        'Content-Disposition': `attachment; filename="factory-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
