import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

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

    for (const table of tables) {
      try {
        const whereClause: any = {}
        // الفلترة بالشركة للجداول التي تدعم companyId
        const companyTables = [
          'worker', 'customer', 'supplier', 'sale', 'purchase',
          'expenseCategory', 'expense', 'treasuryTransaction',
          'warehouse', 'material', 'materialTransaction',
          'product', 'productionOrder', 'payment',
          'saleReturn', 'purchaseReturn', 'auditLog',
        ]
        if (companyTables.includes(table)) {
          whereClause.companyId = companyId
        }

        const records = await (db as any)[table].findMany({
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          orderBy: { createdAt: 'asc' },
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
          return processed
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
