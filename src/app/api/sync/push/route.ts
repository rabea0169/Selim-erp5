import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// POST /api/sync/push - رفع بيانات من IndexedDB للسيرفر
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data, userId } = body

    if (!data) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    const results: Record<string, number> = {}

    // رفع كل الجداول
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

      let count = 0
      for (const record of records) {
        try {
          // تحويل التواريخ
          const processed: any = {}
          for (const [key, value] of Object.entries(record)) {
            if (typeof value === 'string' && (key.includes('date') || key.includes('At') || key.includes('timestamp'))) {
              processed[key] = new Date(value)
            } else if (value !== undefined && value !== null) {
              processed[key] = value
            }
          }

          // upsert (إنشاء أو تحديث)
          await (db as any)[modelName].upsert({
            where: { id: record.id },
            create: processed,
            update: processed,
          })
          count++
        } catch (e: any) {
          console.error(`Error in ${modelName}:`, e.message)
        }
      }
      results[localTable] = count
    }

    return NextResponse.json({
      success: true,
      message: 'تمت المزامنة بنجاح',
      results,
      syncedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('Sync push error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
