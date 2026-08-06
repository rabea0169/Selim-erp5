import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/backup - تصدير كل بيانات الشركة الحالية بصيغة JSON (admin فقط)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    const user = await getCurrentUser()
    const whereCompany = user?.companyId ? { companyId: user.companyId } : {}

    const [
      workers,
      advances,
      receipts,
      attendance,
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
    ] = await Promise.all([
      db.worker.findMany({ where: whereCompany }),
      db.workerAdvance.findMany({ where: whereCompany }),
      db.workerReceipt.findMany({ where: whereCompany }),
      db.workerAttendance.findMany({ where: whereCompany }),
      db.production.findMany({ where: whereCompany }),
      db.customer.findMany({ where: whereCompany }),
      db.supplier.findMany({ where: whereCompany }),
      db.sale.findMany({ where: whereCompany }),
      db.saleItem.findMany(),
      db.purchase.findMany({ where: whereCompany }),
      db.purchaseItem.findMany(),
      db.expenseCategory.findMany({ where: whereCompany }),
      db.expense.findMany({ where: whereCompany }),
      db.product.findMany({ where: whereCompany }),
      db.warehouse.findMany({ where: whereCompany }),
      db.material.findMany({ where: whereCompany }),
      db.materialTransaction.findMany({ where: whereCompany }),
      db.treasuryTransaction.findMany({ where: whereCompany }),
      db.productionOrder.findMany({ where: whereCompany }),
      db.payment.findMany({ where: whereCompany }),
      db.saleReturn.findMany({ where: whereCompany }),
      db.purchaseReturn.findMany({ where: whereCompany }),
      db.factorySettings.findMany({ where: whereCompany }),
      db.auditLog.findMany({ where: whereCompany }),
    ])

    const backup = {
      version: 4,
      app: 'clothing-factory-management',
      exportedAt: new Date().toISOString(),
      companyId: user?.companyId || null,
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
