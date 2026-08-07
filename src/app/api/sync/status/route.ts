import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/sync/status - حالة السيرفر لشركة الجلسة فقط
export async function GET() {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const counts: Record<string, number> = {}
    const tables = [
      'worker', 'customer', 'supplier', 'sale', 'purchase',
      'expense', 'treasuryTransaction', 'product', 'warehouse',
      'material', 'productionOrder', 'payment',
    ]

    for (const table of tables) {
      try {
        counts[table] = await (db as any)[table].count({
          where: { companyId: scope.companyId },
        })
      } catch (e: any) {
        // نسجّل الخطأ بدل ابتلاعه بصمت ونُرجع -1 للدلالة على فشل العد
        console.error(`[Sync] status count failed for ${table}:`, e?.message || e)
        counts[table] = -1
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
