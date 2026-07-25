import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withPartyId } from '@/lib/payment-party'

// GET /api/sync/pull
export async function GET() {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const data: Record<string, any[]> = {}
    const companyId = auth.companyId

    const tables = [
      'factorySettings', 'worker', 'workerAdvance', 'workerReceipt',
      'workerAttendance', 'production', 'customer', 'supplier',
      'sale', 'saleItem', 'purchase', 'purchaseItem',
      'expenseCategory', 'expense', 'treasuryTransaction',
      'warehouse', 'material', 'materialTransaction',
      'product', 'productionOrder', 'payment',
      'saleReturn', 'purchaseReturn', 'auditLog',
    ]

    // الجداول التي تحمل companyId مباشرة
    const companyTables = [
      'factorySettings', 'worker', 'customer', 'supplier', 'sale', 'purchase',
      'expenseCategory', 'expense', 'treasuryTransaction',
      'warehouse', 'material', 'materialTransaction',
      'product', 'productionOrder', 'payment',
      'saleReturn', 'purchaseReturn', 'auditLog',
    ]

    // الجداول التي تُعزل عبر علاقة لأنها لا تحمل companyId
    const relationScopes: Record<string, any> = {
      workerAdvance: { worker: { companyId } },
      workerReceipt: { worker: { companyId } },
      workerAttendance: { worker: { companyId } },
      production: { worker: { companyId } },
      saleItem: { sale: { companyId } },
      purchaseItem: { purchase: { companyId } },
    }

    // ترتيب حسب عمود موجود فعلاً في كل جدول
    const orderBys: Record<string, any> = {
      factorySettings: undefined,
      saleItem: { id: 'asc' },
      purchaseItem: { id: 'asc' },
      auditLog: { timestamp: 'asc' },
    }

    for (const table of tables) {
      try {
        const whereClause: any = companyTables.includes(table)
          ? { companyId }
          : relationScopes[table] ?? {}

        const records = await (db as any)[table].findMany({
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          orderBy: table in orderBys ? orderBys[table] : { createdAt: 'asc' },
        })
        data[table] = records.map((r: any) => {
          const processed: any = {}
          for (const [key, value] of Object.entries(r)) {
            if (value instanceof Date) {
              processed[key] = value.toISOString()
            } else {
              processed[key] = value
            }
          }
          return table === 'payment' ? withPartyId(processed) : processed
        })
      } catch (e: any) {
        console.error(`Error pulling ${table}:`, e.message)
        data[table] = []
      }
    }

    return NextResponse.json({
      success: true,
      data,
      pulledAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('Sync pull error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
