import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/sync/pull - تحميل بيانات من السيرفر لـ IndexedDB
export async function GET() {
  try {
    const data: Record<string, any[]> = {}

    const tables = [
      'factorySettings',
      'worker',
      'workerAdvance',
      'workerReceipt',
      'workerAttendance',
      'production',
      'customer',
      'supplier',
      'sale',
      'saleItem',
      'purchase',
      'purchaseItem',
      'expenseCategory',
      'expense',
      'treasuryTransaction',
      'warehouse',
      'material',
      'materialTransaction',
      'product',
      'productionOrder',
      'payment',
      'saleReturn',
      'purchaseReturn',
      'auditLog',
    ]

    for (const table of tables) {
      try {
        const records = await (db as any)[table].findMany({
          orderBy: { createdAt: 'asc' },
        })
        // تحويل التواريخ لـ ISO string
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
