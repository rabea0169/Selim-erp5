import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/backup - تصدير كل البيانات بصيغة JSON
export async function GET() {
  try {
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
    ] = await Promise.all([
      db.worker.findMany(),
      db.workerAdvance.findMany(),
      db.workerReceipt.findMany(),
      db.workerAttendance.findMany(),
      db.production.findMany(),
      db.customer.findMany(),
      db.supplier.findMany(),
      db.sale.findMany(),
      db.saleItem.findMany(),
      db.purchase.findMany(),
      db.purchaseItem.findMany(),
      db.expenseCategory.findMany(),
      db.expense.findMany(),
    ])

    const backup = {
      version: 2,
      app: 'clothing-factory-management',
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
