import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// حقول مسموحة بتصديرها (للأمان) — تشمل companyId للحفاظ على انتماء السجلات عند إعادة الرفع
const EXPORT_SELECT: Record<string, any> = {
  factorySettings: { companyId: true, factoryName: true, factoryNameEn: true, slogan: true, phone: true, whatsapp: true, email: true, address: true, taxNumber: true, commercialRegister: true, logo: true, currency: true, invoicePrefix: true, invoiceFooter: true, defaultPaperSize: true, taxRate: true, updatedAt: true },
  worker: { id: true, companyId: true, name: true, phone: true, job: true, type: true, hourlyRate: true, overtimeRate: true, workStartTime: true, workHoursPerDay: true, monthlySalary: true, notes: true, createdAt: true, updatedAt: true },
  workerAdvance: { id: true, workerId: true, companyId: true, amount: true, date: true, notes: true, createdAt: true },
  workerReceipt: { id: true, workerId: true, companyId: true, amount: true, date: true, notes: true, createdAt: true },
  workerAttendance: { id: true, companyId: true, workerId: true, date: true, checkIn: true, checkOut: true, status: true, notes: true, workHours: true, overtimeHours: true, lateMinutes: true, createdAt: true },
  production: { id: true, companyId: true, workerId: true, date: true, modelName: true, quantity: true, unitPrice: true, total: true, productId: true, addToInventory: true, notes: true, createdAt: true },
  customer: { id: true, companyId: true, name: true, phone: true, address: true, notes: true, creditLimit: true, loyaltyPoints: true, openingBalance: true, createdAt: true },
  supplier: { id: true, companyId: true, name: true, phone: true, address: true, notes: true, creditLimit: true, openingBalance: true, createdAt: true },
  sale: { id: true, companyId: true, invoiceNo: true, customerName: true, customerId_ref: true, date: true, subtotal: true, discountType: true, discountValue: true, discountAmount: true, taxRate: true, taxAmount: true, extraFees: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  saleItem: { id: true, saleId: true, itemName: true, productId: true, priceType: true, quantity: true, unitPrice: true, total: true },
  purchase: { id: true, companyId: true, invoiceNo: true, supplierName: true, supplierId_ref: true, date: true, subtotal: true, discountType: true, discountValue: true, discountAmount: true, taxRate: true, taxAmount: true, extraFees: true, total: true, paid: true, notes: true, createdAt: true, updatedAt: true },
  purchaseItem: { id: true, purchaseId: true, itemName: true, materialId: true, quantity: true, unitPrice: true, total: true },
  expenseCategory: { id: true, companyId: true, name: true, notes: true, createdAt: true },
  expense: { id: true, companyId: true, categoryId: true, categoryName: true, amount: true, date: true, notes: true, createdAt: true },
  treasuryTransaction: { id: true, companyId: true, type: true, amount: true, date: true, description: true, category: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  warehouse: { id: true, companyId: true, name: true, type: true, location: true, notes: true, createdAt: true },
  material: { id: true, companyId: true, warehouseId: true, name: true, unit: true, quantity: true, unitCost: true, reorderLevel: true, notes: true, createdAt: true, updatedAt: true },
  materialTransaction: { id: true, companyId: true, materialId: true, warehouseId: true, type: true, quantity: true, unitCost: true, date: true, reason: true, referenceType: true, referenceId: true, notes: true, createdAt: true },
  product: { id: true, companyId: true, name: true, category: true, unit: true, wholesalePrice: true, halfWholesalePrice: true, retailPrice: true, cost: true, warehouseId: true, quantity: true, reorderLevel: true, notes: true, createdAt: true, updatedAt: true },
  productionOrder: { id: true, companyId: true, orderNumber: true, productId: true, productName: true, quantity: true, completedQuantity: true, unit: true, status: true, materials: true, stages: true, date: true, expectedEndDate: true, completedDate: true, notes: true, createdAt: true, updatedAt: true },
  payment: { id: true, companyId: true, type: true, partyId: true, partyName: true, invoiceId: true, invoiceNo: true, amount: true, date: true, method: true, notes: true, createdAt: true },
  saleReturn: { id: true, companyId: true, returnNumber: true, saleId: true, invoiceNo: true, customerName: true, customerId_ref: true, date: true, total: true, reason: true, restockItems: true, items: true, notes: true, createdAt: true },
  purchaseReturn: { id: true, companyId: true, returnNumber: true, purchaseId: true, invoiceNo: true, supplierName: true, supplierId_ref: true, date: true, total: true, reason: true, restockItems: true, items: true, notes: true, createdAt: true },
  auditLog: { id: true, companyId: true, userId: true, userName: true, action: true, entityType: true, entityId: true, description: true, metadata: true, timestamp: true },
}

// الجداول المرتبطة مباشرة بـ companyId
// (saleItem/purchaseItem لا يملكان companyId — يُجلَبان عبر الفاتورة الأم)
const CHILD_TABLES: Record<string, { parentModel: string; parentField: string }> = {
  saleItem: { parentModel: 'sale', parentField: 'saleId' },
  purchaseItem: { parentModel: 'purchase', parentField: 'purchaseId' },
}

// POST /api/sync/pull - تحميل بيانات الشركة الحالية فقط (admin فقط)
export async function POST(_req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null

    const data: Record<string, any[]> = {}

    for (const [table, select] of Object.entries(EXPORT_SELECT)) {
      try {
        // auditLog يستخدم timestamp بدل createdAt؛ factorySettings مفتاحه companyId
        const orderByField = table === 'auditLog'
          ? { timestamp: 'asc' as const }
          : table === 'factorySettings'
            ? { updatedAt: 'asc' as const }
            : { createdAt: 'asc' as const }

        // عزل الشركات: كل جدول يُفلتر بشركة المستخدم الحالي فقط
        let where: any
        const child = CHILD_TABLES[table]
        if (child) {
          // جدول فرعي بلا companyId: يُفلتر عبر السجل الأب
          const parentIds = (await (db as any)[child.parentModel].findMany({
            where: { companyId },
            select: { id: true },
          })).map((p: any) => p.id)
          where = { [child.parentField]: { in: parentIds } }
        } else {
          where = { companyId }
        }

        const records = await (db as any)[table].findMany({
          where,
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
          // factorySettings: العميل يتوقع id — نمرره من companyId
          if (table === 'factorySettings') {
            processed.id = processed.companyId
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
