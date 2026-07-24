import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/sync/status - حالة السيرفر
export async function GET() {
  try {
    const counts: Record<string, number> = {}
    const tables = [
      'worker', 'customer', 'supplier', 'sale', 'purchase',
      'expense', 'treasuryTransaction', 'product', 'warehouse',
      'material', 'productionOrder', 'payment',
    ]

    for (const table of tables) {
      try {
        counts[table] = await (db as any)[table].count()
      } catch {
        counts[table] = 0
      }
    }

    return NextResponse.json({
      connected: true,
      counts,
      timestamp: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json({
      connected: false,
      error: e.message,
    }, { status: 500 })
  }
}
