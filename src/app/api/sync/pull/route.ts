import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyAdmin } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// حقول مستبعدة من التصدير (مثل كلمة المرور)
const EXCLUDED_FIELDS: Record<string, string[]> = {
  user: ['passwordHash'],
}

// حقول مسموحة بتصديرها (للأمان)
const EXPORT_SELECT: Record<string, any> = {
  factorySettings: { id: true, factoryName: true, factoryNameEn: true, slogan: true, phone: true, whatsapp: true, email: true, address: true, taxNumber: true, commercialRegister: true, logo: true, currency: true, invoicePrefix: true, invoiceFooter: true, defaultPaperSize: true, taxRate: true, updatedAt: true },
  worker: { id: true, name: true, phone: true, job: true, type: true, hourlyRate: true, overtimeRate: true, workStartTime: true, workHoursPerDay: true, monthlySalary: true, notes: true, createdAt: true, updatedAt: true },
  workerAdvance: { id: true, workerId: true, companyId: true, amount: true, date: true, notes: true, createdAt: true },
  workerReceipt: { id: true, workerId: true, companyId: true, amount: true, date: true, notes: true, createdAt: true },
  workerAttendance: { id: true, workerId: true, date: true, checkIn: true, checkOut: true, status: true, notes: true, workHours: true, overtimeHours: true, lateMinutes: true, createdAt: true },
  production: { id: true, workerId: true, date: true, modelName: true, quantity: true, unitPrice: true, total: true, productId: true, addToInventory: true, notes: true, createdAt: true },
  customer: { id: true, name: true, phone: true, address: true, notes: true, creditLimit: true, loyaltyPoints: true, openingBalance: true, createdAt: true },
  supplier: { id: true, name: true, phone: true, address: true, notes: true, creditLimit: true, openingBalance: true, createdAt: true },
  sale: { id: true, invoiceNo: true, customerName: true, customerId_ref: true, date: true, subtotal: true, discountType: true, discountValue: true, discountAmount: true, taxRate: true, taxAmount: true, extraFees: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  saleItem: { id: true, saleId: true, itemName: true, productId: true, priceType: true, quantity: true, unitPrice: true, total: true },
  purchase: { id: true, invoiceNo: true, supplierName: true, supplierId_ref: true, date: true, subtotal: true, discountType: true, discountValue: true, discountAmount: true, taxRate: true, taxAmount: true, extraFees: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  purchaseItem: { id: true, purchaseId: true, itemName: true, materialId: true, quantity: true, unitPrice: true, total: true },
  expenseCategory: { id: true, name: true, notes: true, createdAt: true },
  expense: { id: true, categoryId: true, categoryName: true, amount: true, date: true, notes: true, createdAt: true },
  treasuryTransaction: { id: true, type: true, amount: true, date: true, description: true, category: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  warehouse: { id: true, name: true, type: true, location: true, notes: true, createdAt: true },
  material: { id: true, warehouseId: true, name: true, unit: true, quantity: true, unitCost: true, reorderLevel: true, notes: true, createdAt: true, updatedAt: true },
  materialTransaction: { id: true, materialId: true, warehouseId: true, type: true, quantity: true, unitCost: true, date: true, reason: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  product: { id: true, name: true, category: true, unit: true, wholesalePrice: true, halfWholesalePrice: true, retailPrice: true, cost: true, warehouseId: true, quantity: true, reorderLevel: true, notes: true, createdAt: true, updatedAt: true },
  productionOrder: { id: true, orderNumber: true, productId: true, productName: true, quantity: true, completedQuantity: true, unit: true, status: true, materials: true, stages: true, date: true, expectedEndDate: true, completedDate: true, notes: true, createdAt: true, updatedAt: true },
  payment: { id: true, type: true, partyId: true, partyName: true, invoiceId: true, invoiceNo: true, amount: true, date: true, method: true, notes: true, createdAt: true },
  saleReturn: { id: true, returnNumber: true, saleId: true, invoiceNo: true, customerName: true, customerId_ref: true, date: true, total: true, reason: true, restockItems: true, items: true, notes: true, createdAt: true },
  purchaseReturn: { id: true, returnNumber: true, purchaseId: true, invoiceNo: true, supplierName: true, supplierId_ref: true, date: true, total: true, reason: true, restockItems: true, items: true, notes: true, createdAt: true },
  auditLog: { id: true, userId: true, userName: true, action: true, entityType: true, entityId: true, description: true, metadata: true, timestamp: true },
}

// فلتر العزل لكل جدول — companyId يُفرض من الجلسة فقط
// الجداول الفرعية (لا تملك companyId) تُفلتر عبر السجل الأب
function buildWhere(table: string, companyId: string): any {
  if (table === 'saleItem') return { sale: { companyId } }
  if (table === 'purchaseItem') return { purchase: { companyId } }
  return { companyId }
}

// Fix O: Changed from GET to POST
// POST /api/sync/pull - تنزيل بيانات شركة الجلسة فقط (admin داخل الشركة)
export async function POST(_req: NextRequest) {
  try {
    // تحقق admin + فرض نطاق الشركة من الجلسة (عزل المستأجرين)
    const scope = await requireCompanyAdmin()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }
    const companyId = scope.companyId

    const data: Record<string, any[]> = {}

    for (const [table, select] of Object.entries(EXPORT_SELECT)) {
      try {
        // auditLog يستخدم timestamp بدل createdAt
        const orderByField = table === 'auditLog' ? { timestamp: 'asc' as const } : { createdAt: 'asc' as const }
        const records = await (db as any)[table].findMany({
          where: buildWhere(table, companyId),
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
        console.error(`[Sync] Error pulling ${table}:`, e?.message)
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
