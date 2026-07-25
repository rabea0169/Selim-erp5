import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { handleApiError } from '@/lib/api-error'

// POST /api/sync/push
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    const results: Record<string, number> = {}
    const failures: Array<{ table: string; id?: string; error: string }> = []

    const tableMap: Record<string, any> = {
      users: 'user',
      factorySettings: 'factorySettings',
      workers: 'worker',
      workerAdvances: 'workerAdvance',
      workerReceipts: 'workerReceipt',
      workerAttendance: 'workerAttendance',
      production: 'production',
      customers: 'customer',
      suppliers: 'supplier',
      sales: 'sale',
      saleItems: 'saleItem',
      purchases: 'purchase',
      purchaseItems: 'purchaseItem',
      expenseCategories: 'expenseCategory',
      expenses: 'expense',
      treasuryTransactions: 'treasuryTransaction',
      warehouses: 'warehouse',
      materials: 'material',
      materialTransactions: 'materialTransaction',
      products: 'product',
      productionOrders: 'productionOrder',
      payments: 'payment',
      saleReturns: 'saleReturn',
      purchaseReturns: 'purchaseReturn',
      auditLogs: 'auditLog',
    }

    for (const [localTable, modelName] of Object.entries(tableMap)) {
      const records = data[localTable]
      if (!records || !Array.isArray(records) || records.length === 0) continue

      // حقول العلاقات التي يجب حذفها قبل الحفظ
      const relationFields = ['worker', 'customer', 'supplier', 'sale', 'purchase',
        'category', 'warehouse', 'material', 'company', 'items', 'returns',
        'advances', 'receipts', 'attendance', 'productions', 'auditLogs',
        'payments', 'saleReturns', 'purchaseReturns', '_count']

      let count = 0
      for (const record of records) {
        try {
          const processed: any = {}
          for (const [key, value] of Object.entries(record)) {
            // تخطي حقول العلاقات والحقول الفارغة
            if (relationFields.includes(key)) continue
            if (value === undefined || value === null) continue

            if (typeof value === 'string' && (key.includes('date') || key.includes('At') || key.includes('timestamp'))) {
              processed[key] = new Date(value as string)
            } else {
              processed[key] = value
            }
          }

          // ضمان companyId الصحيح — لا يسمح للعميل بتحديد companyId مختلف
          if ('companyId' in processed) {
            processed.companyId = auth.companyId
          }

          if (!processed.id) continue

          await (db as any)[modelName].upsert({
            where: { id: processed.id },
            create: processed,
            update: processed,
          })
          count++
        } catch (e) {
          console.error(`[API] POST /api/sync/push failed for ${modelName}:`, e)
          failures.push({
            table: localTable,
            id: record?.id,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      }
      results[localTable] = count
    }

    if (failures.length > 0) {
      return NextResponse.json({
        success: false,
        error: `تعذر رفع ${failures.length} سجل`,
        results,
        failures: failures.slice(0, 20),
        failedCount: failures.length,
        syncedAt: new Date().toISOString(),
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      message: 'تمت المزامنة بنجاح',
      results,
      syncedAt: new Date().toISOString(),
    })
  } catch (e) {
    return handleApiError(e, 'POST /api/sync/push')
  }
}
