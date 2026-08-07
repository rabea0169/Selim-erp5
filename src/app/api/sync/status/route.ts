import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// GET /api/sync/status - حالة السيرفر (عدّ السجلات داخل شركة المستخدم فقط)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null

    const counts: Record<string, number> = {}
    const tables = [
      'worker', 'customer', 'supplier', 'sale', 'purchase',
      'expense', 'treasuryTransaction', 'product', 'warehouse',
      'material', 'productionOrder', 'payment',
    ]

    for (const table of tables) {
      try {
        counts[table] = await (db as any)[table].count({ where: { companyId } })
      } catch {
        counts[table] = 0
      }
    }

    return NextResponse.json({
      connected: true,
      counts,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ connected: false, error }, { status })
  }
}
