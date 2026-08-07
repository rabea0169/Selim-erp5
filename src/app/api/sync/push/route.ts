import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// حقول محظورة من التزامن (لا يسمح للعميل بتعديلها)
const FORBIDDEN_FIELDS: Record<string, string[]> = {
  user: ['passwordHash', 'role'],
}

// حقول مسموحة لكل نموذج (أمان بالسماح لا بالمنع)
const ALLOWED_FIELDS: Record<string, string[]> = {
  factorySettings: ['id', 'factoryName', 'factoryNameEn', 'slogan', 'phone', 'whatsapp', 'email', 'address', 'taxNumber', 'commercialRegister', 'logo', 'currency', 'invoicePrefix', 'invoiceFooter', 'defaultPaperSize', 'taxRate', 'createdAt', 'updatedAt'],
  worker: ['id', 'name', 'phone', 'job', 'type', 'hourlyRate', 'overtimeRate', 'workStartTime', 'workHoursPerDay', 'monthlySalary', 'notes', 'createdAt', 'updatedAt'],
  workerAdvance: ['id', 'workerId', 'companyId', 'amount', 'date', 'notes', 'createdAt'],
  workerReceipt: ['id', 'workerId', 'companyId', 'amount', 'date', 'notes', 'createdAt'],
  workerAttendance: ['id', 'workerId', 'date', 'checkIn', 'checkOut', 'status', 'notes', 'workHours', 'overtimeHours', 'lateMinutes', 'createdAt'],
  production: ['id', 'workerId', 'date', 'modelName', 'quantity', 'unitPrice', 'total', 'productId', 'addToInventory', 'notes', 'createdAt'],
  customer: ['id', 'name', 'phone', 'address', 'notes', 'creditLimit', 'loyaltyPoints', 'openingBalance', 'createdAt'],
  supplier: ['id', 'name', 'phone', 'address', 'notes', 'creditLimit', 'openingBalance', 'createdAt'],
  sale: ['id', 'invoiceNo', 'customerName', 'customerId_ref', 'date', 'subtotal', 'discountType', 'discountValue', 'discountAmount', 'taxRate', 'taxAmount', 'extraFees', 'total', 'paid', 'notes', 'createdAt', 'updatedAt'],
  saleItem: ['id', 'saleId', 'itemName', 'productId', 'priceType', 'quantity', 'unitPrice', 'total'],
  purchase: ['id', 'invoiceNo', 'supplierName', 'supplierId_ref', 'date', 'subtotal', 'discountType', 'discountValue', 'discountAmount', 'taxRate', 'taxAmount', 'extraFees', 'total', 'paid', 'notes', 'createdAt', 'updatedAt'],
  purchaseItem: ['id', 'purchaseId', 'itemName', 'materialId', 'quantity', 'unitPrice', 'total'],
  expenseCategory: ['id', 'name', 'notes', 'createdAt'],
  expense: ['id', 'categoryId', 'categoryName', 'amount', 'date', 'notes', 'createdAt'],
  treasuryTransaction: ['id', 'type', 'amount', 'date', 'description', 'category', 'referenceType', 'referenceId', 'notes', 'createdAt'],
  warehouse: ['id', 'name', 'type', 'location', 'notes', 'createdAt'],
  material: ['id', 'warehouseId', 'name', 'unit', 'quantity', 'unitCost', 'reorderLevel', 'notes', 'createdAt', 'updatedAt'],
  materialTransaction: ['id', 'materialId', 'warehouseId', 'type', 'quantity', 'unitCost', 'date', 'reason', 'referenceType', 'referenceId', 'notes', 'createdAt'],
  product: ['id', 'name', 'category', 'unit', 'wholesalePrice', 'halfWholesalePrice', 'retailPrice', 'cost', 'warehouseId', 'quantity', 'reorderLevel', 'notes', 'createdAt', 'updatedAt'],
  productionOrder: ['id', 'orderNumber', 'productId', 'productName', 'quantity', 'completedQuantity', 'unit', 'status', 'materials', 'stages', 'date', 'expectedEndDate', 'completedDate', 'notes', 'createdAt', 'updatedAt'],
  payment: ['id', 'type', 'partyId', 'partyName', 'invoiceId', 'invoiceNo', 'amount', 'date', 'method', 'notes', 'createdAt'],
  saleReturn: ['id', 'returnNumber', 'saleId', 'invoiceNo', 'customerName', 'customerId_ref', 'date', 'total', 'reason', 'restockItems', 'items', 'notes', 'createdAt'],
  purchaseReturn: ['id', 'returnNumber', 'purchaseId', 'invoiceNo', 'supplierName', 'supplierId_ref', 'date', 'total', 'reason', 'restockItems', 'items', 'notes', 'createdAt'],
  auditLog: ['id', 'action', 'entityType', 'entityId', 'description', 'userId', 'userName', 'metadata', 'timestamp'],
}

const MODELS_WITH_COMPANY = new Set([
  'factorySettings',
  'worker',
  'workerAdvance',
  'workerReceipt',
  'workerAttendance',
  'production',
  'customer',
  'supplier',
  'sale',
  'purchase',
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
])

// POST /api/sync/push - رفع بيانات من IndexedDB للسيرفر لأي مستخدم داخل الشركة
export async function POST(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const body = await req.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: 'لا توجد بيانات' }, { status: 400 })
    }

    const results: Record<string, { success: number; failed: number }> = {}

    const tableMap: Record<string, any> = {
      // ⚠️ users و auditLogs مستثنيان من المزامنة لحماية الصلاحيات وسجل التدقيق
      factorySettings: 'factorySettings',
      workers: 'worker',
      workerAdvances: 'workerAdvance',
      workerReceipts: 'workerReceipt',
      workerAttendance: 'workerAttendance',
      products: 'product',
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
            if (forbidden.includes(key)) continue

            if (typeof value === 'string' && (key.includes('date') || key.includes('At') || key === 'checkIn' || key === 'checkOut')) {
              const d = new Date(value)
              if (!isNaN(d.getTime())) {
                processed[key] = d
              }
            } else if (value !== undefined && value !== null) {
              if (!allowed || allowed.includes(key)) {
                processed[key] = value
              }
            }
          }

          if (allowed?.includes('updatedAt')) {
            processed.updatedAt = new Date()
          }

          const { id: _ignoredId, ...updateData } = processed
          const createData = { ...updateData, id: record.id }

          if (modelName === 'factorySettings') {
            delete updateData.id
            delete createData.id
            await db.factorySettings.upsert({
              where: { companyId: scope.companyId },
              update: updateData,
              create: { ...createData, companyId: scope.companyId },
            })
            successCount++
            continue
          }

          if (modelName === 'saleItem') {
            const parent = await db.sale.findFirst({
              where: { id: record.saleId, companyId: scope.companyId },
              select: { id: true },
            })
            if (!parent) { failedCount++; continue }

            await db.saleItem.upsert({
              where: { id: record.id },
              create: createData,
              update: updateData,
            })
            successCount++
            continue
          }

          if (modelName === 'purchaseItem') {
            const parent = await db.purchase.findFirst({
              where: { id: record.purchaseId, companyId: scope.companyId },
              select: { id: true },
            })
            if (!parent) { failedCount++; continue }

            await db.purchaseItem.upsert({
              where: { id: record.id },
              create: createData,
              update: updateData,
            })
            successCount++
            continue
          }

          if (MODELS_WITH_COMPANY.has(modelName)) {
            updateData.companyId = scope.companyId
            createData.companyId = scope.companyId

            const existing = await (db as any)[modelName].findUnique({
              where: { id: record.id },
              select: { companyId: true },
            })

            if (existing && existing.companyId !== scope.companyId) {
              failedCount++
              continue
            }
          }

          await (db as any)[modelName].upsert({
            where: { id: record.id },
            create: createData,
            update: updateData,
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
