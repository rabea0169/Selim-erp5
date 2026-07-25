import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

// GET /api/sync/status
export async function GET() {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const counts: Record<string, number> = {}
    const companyFilter = { companyId: auth.companyId }
    const tables = [
      'worker', 'customer', 'supplier', 'sale', 'purchase',
      'expense', 'treasuryTransaction', 'product', 'warehouse',
      'material', 'productionOrder', 'payment',
    ]

    for (const table of tables) {
      try {
        counts[table] = await (db as any)[table].count({ where: companyFilter })
      } catch (e) {
        console.error(`[API] GET /api/sync/status failed for ${table}:`, e)
        counts[table] = 0
      }
    }

    return NextResponse.json({
      connected: true,
      counts,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[API] GET /api/sync/status failed:', e)
    return NextResponse.json({
      connected: false,
      error: 'تعذر الاتصال بالخادم',
    }, { status: 500 })
  }
}
