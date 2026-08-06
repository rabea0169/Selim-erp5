import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// حقول محظورة من التزامن (لا يسمح للعميل بتعديلها)
const FORBIDDEN_FIELDS: Record<string, string[]> = {
  user: ['passwordHash', 'role'],
}

// حقول مسموحة لكل نموذج (أمان بالسماح لا بالمنع)
const ALLOWED_FIELDS: Record<string, string[]> = {
  factorySettings: ['id', 'factoryName', 'taxNumber', 'commercialRegister', 'phone', 'address', 'logo', 'notes', 'createdAt', 'updatedAt'],
  worker: ['id', 'name', 'phone', 'job', 'type', 'dailyWage', 'monthlySalary', 'notes', 'createdAt', 'updatedAt'],
  workerAdvance: ['id', 'workerId', 'amount', 'date', 'notes', 'createdAt'],
  workerReceipt: ['id', 'workerId', 'amount', 'date', 'notes', 'createdAt'],
  workerAttendance: ['id', 'workerId', 'date', 'checkIn', 'checkOut', 'status', 'notes', 'createdAt'],
  production: ['id', 'workerId', 'date', 'modelName', 'quantity', 'unitPrice', 'total', 'notes', 'createdAt'],
  customer: ['id', 'name', 'phone', 'address', 'notes', 'createdAt'],
  supplier: ['id', 'name', 'phone', 'address', 'notes', 'createdAt'],
  sale: ['id', 'invoiceNo', 'customerName', 'customerId_ref', 'date', 'total', 'paid', 'notes', 'createdAt', 'updatedAt'],
  saleItem: ['id', 'saleId', 'itemName', 'productId', 'priceType', 'quantity', 'unitPrice', 'total'],
  purchase: ['id', 'invoiceNo', 'supplierName', 'supplierId_ref', 'date', 'total', 'paid', 'notes', 'createdAt', 'updatedAt'],
  purchaseItem: ['id', 'purchaseId', 'itemName', 'materialId', 'quantity', 'unitPrice', 'total'],
  expenseCategory: ['id', 'name', 'notes', 'createdAt'],
  expense: ['id', 'categoryId', 'categoryName', 'amount', 'date', 'notes', 'createdAt'],
  treasuryTransaction: ['id', 'type', 'amount', 'date', 'description', 'category', 'referenceType', 'referenceId', 'notes', 'createdAt'],
  warehouse: ['id', 'name', 'type', 'notes', 'createdAt'],
  material: ['id', 'warehouseId', 'name', 'unit', 'quantity', 'unitCost', 'minStock', 'notes', 'createdAt', 'updatedAt'],
  materialTransaction: ['id', 'materialId', 'warehouseId', 'type', 'quantity', 'unitCost', 'date', 'reason', 'referenceType', 'referenceId', 'notes', 'createdAt'],
  product: ['id', 'name', 'warehouseId', 'sku', 'unit', 'quantity', 'retailPrice', 'wholesalePrice', 'costPrice', 'minStock', 'notes', 'createdAt', 'updatedAt'],
  productionOrder: ['id', 'orderNumber', 'productId', 'productName', 'quantity', 'completedQuantity', 'unit', 'status', 'materials', 'stages', 'date', 'expectedEndDate', 'completedDate', 'notes', 'createdAt', 'updatedAt'],
  payment: ['id', 'partyId', 'partyName', 'type', 'amount', 'date', 'referenceType', 'referenceId', 'notes', 'createdAt'],
  saleReturn: ['id', 'saleId', 'customerId_ref', 'customerName', 'date', 'total', 'notes', 'items', 'createdAt'],
  purchaseReturn: ['id', 'purchaseId', 'supplierId_ref', 'supplierName', 'date', 'total', 'notes', 'items', 'createdAt'],
  auditLog: ['id', 'action', 'entityType', 'entityId', 'description', 'userId', 'userName', 'metadata', 'timestamp'],
}

// POST /api/sync/push - رفع بيانات من IndexedDB للسيرفر (admin فقط)
export async function POST(req: NextRequest) {
  try {
    // تحقق admin
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    const body = await req.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    const results: Record<string, { success: number; failed: number }> = {}

    const tableMap: Record<string, any> = {
      // ⚠️ users و auditLogs مستثنيان من المزامنة لحماية الصلاحيات وسجل التدقيق
      // users: 'user',          // GAP-01 fix: لا يسمح بمزامنة بيانات المستخدمين (يمنع تصعيد الصلاحيات)
      // auditLogs: 'auditLog',  // GAP-01 fix: لا يسمح بمزامنة سجل التدقيق
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
    }

    for (const [localTable, modelName] of Object.entries(tableMap)) {
      const records = data[localTable]
      if (!records || !Array.isArray(records) || records.length === 0) {
        results[localTable] = { success: 0, failed: 0 }
        continue
      }

      const allowed = ALLOWED_FIELDS[modelName]
      const forbidden = FORBIDDEN_FIELDS[modelName] || []
      let successCount = 0
      let failedCount = 0

      for (const record of records) {
        try {
          if (!record.id) { failedCount++; continue }

          // فلترة الحقول المسموحة فقط
          const processed: any = {}
          for (const [key, value] of Object.entries(record)) {
            // تجاهل الحقول المحظورة
            if (forbidden.includes(key)) continue

            // تحويل التواريخ
            if (typeof value === 'string' && (key.includes('date') || key.includes('At') || key === 'checkIn' || key === 'checkOut')) {
              const d = new Date(value)
              if (!isNaN(d.getTime())) {
                processed[key] = d
              }
            } else if (value !== undefined && value !== null) {
              // لو في قائمة المسموحات نستخدمها، وإلا نسقط الحقل
              if (!allowed || allowed.includes(key)) {
                processed[key] = value
              }
            }
          }

          processed.updatedAt = new Date()
          const user = await getCurrentUser()
          if (user?.companyId) {
            processed.companyId = user.companyId
          }

          await (db as any)[modelName].upsert({
            where: { id: record.id },
            create: processed,
            update: processed,
          })
          successCount++
        } catch (e: any) {
          console.error(`[Sync] Error in ${modelName} record ${record.id}:`, e.message)
          failedCount++
        }
      }
      results[localTable] = { success: successCount, failed: failedCount }
    }

    return NextResponse.json({
      success: true,
      message: 'تمت المزامنة بنجاح',
      results,
      syncedAt: new Date().toISOString(),
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
