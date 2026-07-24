import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/permissions'

// GET /api/backup
export async function GET() {
  try {
    const auth = await requireAuth('backup')
    if (!auth.authorized) return auth.response

    const [
      workers, advances, receipts, attendance, production,
      customers, suppliers, sales, saleItems, purchases, purchaseItems,
      expenseCategories, expenses,
    ] = await Promise.all([
      db.worker.findMany({ where: { companyId: auth.companyId } }),
      db.workerAdvance.findMany(),
      db.workerReceipt.findMany(),
      db.workerAttendance.findMany(),
      db.production.findMany(),
      db.customer.findMany({ where: { companyId: auth.companyId } }),
      db.supplier.findMany({ where: { companyId: auth.companyId } }),
      db.sale.findMany({ where: { companyId: auth.companyId } }),
      db.saleItem.findMany(),
      db.purchase.findMany({ where: { companyId: auth.companyId } }),
      db.purchaseItem.findMany(),
      db.expenseCategory.findMany({ where: { companyId: auth.companyId } }),
      db.expense.findMany({ where: { companyId: auth.companyId } }),
    ])

    const backup = {
      version: 2,
      app: 'clothing-factory-management',
      exportedAt: new Date().toISOString(),
      data: {
        workers, workerAdvances: advances, workerReceipts: receipts,
        workerAttendance: attendance, production, customers, suppliers,
        sales, saleItems, purchases, purchaseItems,
        expenseCategories, expenses,
      },
    }

    return NextResponse.json(backup, {
      headers: {
        'Content-Disposition': `attachment; filename="factory-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
