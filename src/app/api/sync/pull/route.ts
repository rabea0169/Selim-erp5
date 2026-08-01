import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// حقول مستبعدة من التصدير (مثل كلمة المرور)
const EXCLUDED_FIELDS: Record<string, string[]> = {
  user: ['passwordHash'],
}

// حقول مسموحة بتصديرها (للأمان)
const EXPORT_SELECT: Record<string, any> = {
  factorySettings: { id: true, factoryName: true, taxNumber: true, commercialRegister: true, phone: true, address: true, logo: true, notes: true, createdAt: true, updatedAt: true },
  worker: { id: true, name: true, phone: true, job: true, type: true, dailyWage: true, monthlySalary: true, notes: true, createdAt: true, updatedAt: true },
  workerAdvance: { id: true, workerId: true, amount: true, date: true, notes: true, createdAt: true },
  workerReceipt: { id: true, workerId: true, amount: true, date: true, notes: true, createdAt: true },
  workerAttendance: { id: true, workerId: true, date: true, checkIn: true, checkOut: true, status: true, notes: true, createdAt: true },
  production: { id: true, workerId: true, date: true, modelName: true, quantity: true, unitPrice: true, total: true, notes: true, createdAt: true },
  customer: { id: true, name: true, phone: true, address: true, notes: true, createdAt: true },
  supplier: { id: true, name: true, phone: true, address: true, notes: true, createdAt: true },
  sale: { id: true, invoiceNo: true, customerName: true, customerId_ref: true, date: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  saleItem: { id: true, saleId: true, itemName: true, productId: true, priceType: true, quantity: true, unitPrice: true, total: true },
  purchase: { id: true, invoiceNo: true, supplierName: true, supplierId_ref: true, date: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  purchaseItem: { id: true, purchaseId: true, itemName: true, materialId: true, quantity: true, unitPrice: true, total: true },
  expenseCategory: { id: true, name: true, notes: true, createdAt: true },
  expense: { id: true, categoryId: true, categoryName: true, amount: true, date: true, notes: true, createdAt: true },
  treasuryTransaction: { id: true, type: true, amount: true, date: true, description: true, category: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  warehouse: { id: true, name: true, type: true, notes: true, createdAt: true },
  material: { id: true, warehouseId: true, name: true, unit: true, quantity: true, unitCost: true, minStock: true, notes: true, createdAt: true, updatedAt: true },
  materialTransaction: { id: true, materialId: true, warehouseId: true, type: true, quantity: true, unitCost: true, date: true, reason: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  product: { id: true, name: true, warehouseId: true, sku: true, unit: true, quantity: true, retailPrice: true, wholesalePrice: true, costPrice: true, minStock: true, notes: true, createdAt: true, updatedAt: true },
  productionOrder: { id: true, orderNumber: true, productId: true, productName: true, quantity: true, completedQuantity: true, unit: true, status: true, materials: true, stages: true, date: true, expectedEndDate: true, completedDate: true, notes: true, createdAt: true, updatedAt: true },
  payment: { id: true, partyId: true, partyName: true, type: true, amount: true, date: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  saleReturn: { id: true, saleId: true, customerId_ref: true, customerName: true, date: true, total: true, notes: true, items: true, createdAt: true },
  purchaseReturn: { id: true, purchaseId: true, supplierId_ref: true, supplierName: true, date: true, total: true, notes: true, items: true, createdAt: true },
  auditLog: { id: true, action: true, entityType: true, entityId: true, description: true, userId: true, userName: true, timestamp: true },
}

// GET /api/sync/pull - تحميل بيانات من السيرفر لـ IndexedDB (admin فقط)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    const data: Record<string, any[]> = {}

    for (const [table, select] of Object.entries(EXPORT_SELECT)) {
      try {
        // auditLog يستخدم timestamp بدل createdAt
        const orderByField = table === 'auditLog' ? { timestamp: 'asc' as const } : { createdAt: 'asc' as const }
        const records = await (db as any)[table].findMany({
          orderBy: orderByField,
          select,
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
        console.error(`[Sync] Error pulling ${table}:`, e.message)
        data[table] = []
      }
    }

    return NextResponse.json({
      success: true,
      data,
      pulledAt: new Date().toISOString(),
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
