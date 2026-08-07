import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// تنفيذ استعلام كيان واحد بشكل مستقل — عند الفشل نسجل الخطأ ونعيد مصفوفة فارغة
// حتى لا يُسقط استعلام فاشل واحد (جدول/عمود مفقود) التصدير بالكامل بـ 500
async function tryQuery<T>(name: string, warnings: string[], fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn()
  } catch (e) {
    console.error('[backup] entity failed:', name, e)
    warnings.push(name)
    return []
  }
}

// GET /api/backup - تصدير بيانات الشركة الحالية فقط بصيغة JSON (admin فقط)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null
    const warnings: string[] = []

    // Fix: عزل كامل بالشركة — الجداول الفرعية (saleItems/purchaseItems) عبر معرفات الآباء
    const sales = await tryQuery('sales', warnings, () => db.sale.findMany({ where: { companyId } }))
    const purchases = await tryQuery('purchases', warnings, () => db.purchase.findMany({ where: { companyId } }))
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
      tryQuery('workers', warnings, () => db.worker.findMany({ where: { companyId } })),
      tryQuery('workerAdvances', warnings, () => db.workerAdvance.findMany({ where: { companyId } })),
      tryQuery('workerReceipts', warnings, () => db.workerReceipt.findMany({ where: { companyId } })),
      tryQuery('workerAttendance', warnings, () => db.workerAttendance.findMany({ where: { companyId } })),
      tryQuery('production', warnings, () => db.production.findMany({ where: { companyId } })),
      tryQuery('customers', warnings, () => db.customer.findMany({ where: { companyId } })),
      tryQuery('suppliers', warnings, () => db.supplier.findMany({ where: { companyId } })),
      tryQuery('saleItems', warnings, () => db.saleItem.findMany({ where: { saleId: { in: saleIds } } })),
      tryQuery('purchaseItems', warnings, () => db.purchaseItem.findMany({ where: { purchaseId: { in: purchaseIds } } })),
      tryQuery('expenseCategories', warnings, () => db.expenseCategory.findMany({ where: { companyId } })),
      tryQuery('expenses', warnings, () => db.expense.findMany({ where: { companyId } })),
      tryQuery('products', warnings, () => db.product.findMany({ where: { companyId } })),
      tryQuery('warehouses', warnings, () => db.warehouse.findMany({ where: { companyId } })),
      tryQuery('materials', warnings, () => db.material.findMany({ where: { companyId } })),
      tryQuery('materialTransactions', warnings, () => db.materialTransaction.findMany({ where: { companyId } })),
      tryQuery('treasuryTransactions', warnings, () => db.treasuryTransaction.findMany({ where: { companyId } })),
      tryQuery('productionOrders', warnings, () => db.productionOrder.findMany({ where: { companyId } })),
      tryQuery('payments', warnings, () => db.payment.findMany({ where: { companyId } })),
      tryQuery('saleReturns', warnings, () => db.saleReturn.findMany({ where: { companyId } })),
      tryQuery('purchaseReturns', warnings, () => db.purchaseReturn.findMany({ where: { companyId } })),
      tryQuery('factorySettings', warnings, () => db.factorySettings.findMany({ where: { companyId: companyId ?? '__none__' } })),
      tryQuery('auditLogs', warnings, () => db.auditLog.findMany({ where: { companyId } })),
    ])

    const backup = {
      version: 4,
      app: 'clothing-factory-management',
      companyId,
      exportedAt: new Date().toISOString(),
      // أسماء الكيانات التي تعذّر تصديرها (فارغة في الحالة الطبيعية)
      warnings,
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
