import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// أحدث إصدار مدعوم من بنية ملف النسخة
const SUPPORTED_BACKUP_VERSION = 4

// مفاتيح الكيانات المتوقعة في ملف النسخة (يجب أن تكون قوائم إن وُجدت)
const COLLECTION_KEYS = [
  'workers',
  'workerAdvances',
  'workerReceipts',
  'workerAttendance',
  'production',
  'customers',
  'suppliers',
  'sales',
  'saleItems',
  'purchases',
  'purchaseItems',
  'expenseCategories',
  'expenses',
  'products',
  'warehouses',
  'materials',
  'materialTransactions',
  'treasuryTransactions',
  'productionOrders',
  'payments',
  'saleReturns',
  'purchaseReturns',
  'factorySettings',
] as const

function idSet(arr?: any[]): Set<string> {
  return new Set((arr || []).map((x) => x?.id).filter(Boolean))
}

/**
 * يتحقق أن كل مراجع (foreign keys) داخل الملف تشير إلى آباء موجودين في الملف نفسه.
 * هذا يمنع ربط بيانات الشركة بسجلات شركة أخرى موجودة في قاعدة البيانات
 * (بعد المسح، أي مرجع صالح يجب أن يكون من النسخة ذاتها).
 */
function findInvalidRef(
  items: any[] | undefined,
  getRef: (x: any) => string | null | undefined,
  validIds: Set<string>,
): boolean {
  if (!items) return false
  return items.some((x) => {
    const ref = getRef(x)
    return !!ref && !validIds.has(ref)
  })
}

// POST /api/restore - استرجاع بيانات الشركة الحالية فقط من ملف JSON (admin فقط)
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId ?? null

    const body = await req.json()
    const { data, confirm, version } = body

    // GAP-02 fix: يتطلب تأكيد صريح لمنع المسح العرضي
    if (confirm !== 'WIPE_AND_RESTORE') {
      return NextResponse.json({ error: 'يجب تمرير confirm: "WIPE_AND_RESTORE" للتأكيد' }, { status: 400 })
    }

    // ====== التحقق من بنية ملف النسخة قبل لمس قاعدة البيانات ======
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json(
        { error: 'ملف النسخة الاحتياطية غير صالح — بنية البيانات غير صحيحة' },
        { status: 400 },
      )
    }

    // رفض ملفات أحدث من الإصدار المدعوم
    if (typeof version === 'number' && version > SUPPORTED_BACKUP_VERSION) {
      return NextResponse.json(
        { error: `إصدار النسخة (${version}) أحدث من المدعوم في التطبيق (${SUPPORTED_BACKUP_VERSION}) — حدّث التطبيق أولاً` },
        { status: 400 },
      )
    }

    // كل مفتاح موجود يجب أن يكون قائمة
    for (const key of COLLECTION_KEYS) {
      if (data[key] !== undefined && !Array.isArray(data[key])) {
        return NextResponse.json(
          { error: `ملف النسخة الاحتياطية تالف — الحقل "${key}" يجب أن يكون قائمة` },
          { status: 400 },
        )
      }
    }

    // يجب أن يحتوي الملف على كيان واحد على الأقل
    const totalRecords = COLLECTION_KEYS.reduce(
      (sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0),
      0,
    )
    if (totalRecords === 0) {
      return NextResponse.json(
        { error: 'ملف النسخة الاحتياطية فارغ — لا توجد بيانات للاسترجاع' },
        { status: 400 },
      )
    }

    // ====== التحقق من تكامل المراجع داخل الملف (منع الربط ببيانات شركة أخرى) ======
    const salesIds = idSet(data.sales)
    const purchaseIds = idSet(data.purchases)
    const workerIds = idSet(data.workers)
    const productIds = idSet(data.products)
    const warehouseIds = idSet(data.warehouses)
    const materialIds = idSet(data.materials)
    const categoryIds = idSet(data.expenseCategories)
    const customerIds = idSet(data.customers)
    const supplierIds = idSet(data.suppliers)

    const refChecks: Array<{ invalid: boolean; label: string }> = [
      { invalid: findInvalidRef(data.saleItems, (x) => x.saleId, salesIds), label: 'عناصر مبيعات لا تتبع فواتير موجودة في النسخة' },
      { invalid: findInvalidRef(data.purchaseItems, (x) => x.purchaseId, purchaseIds), label: 'عناصر مشتريات لا تتبع فواتير موجودة في النسخة' },
      { invalid: findInvalidRef(data.workerAdvances, (x) => x.workerId, workerIds), label: 'سلف عمال لا تتبع عمالاً موجودين في النسخة' },
      { invalid: findInvalidRef(data.workerReceipts, (x) => x.workerId, workerIds), label: 'قبضيات عمال لا تتبع عمالاً موجودين في النسخة' },
      { invalid: findInvalidRef(data.workerAttendance, (x) => x.workerId, workerIds), label: 'سجلات حضور لا تتبع عمالاً موجودين في النسخة' },
      { invalid: findInvalidRef(data.production, (x) => x.workerId, workerIds), label: 'سجلات إنتاج لا تتبع عمالاً موجودين في النسخة' },
      { invalid: findInvalidRef(data.production, (x) => x.productId, productIds), label: 'سجلات إنتاج مرتبطة بمنتجات غير موجودة في النسخة' },
      { invalid: findInvalidRef(data.expenses, (x) => x.categoryId, categoryIds), label: 'مصاريف لا تتبع فئات موجودة في النسخة' },
      { invalid: findInvalidRef(data.materials, (x) => x.warehouseId, warehouseIds), label: 'مواد خام لا تتبع مخازن موجودة في النسخة' },
      { invalid: findInvalidRef(data.products, (x) => x.warehouseId, warehouseIds), label: 'منتجات لا تتبع مخازن موجودة في النسخة' },
      { invalid: findInvalidRef(data.materialTransactions, (x) => x.materialId, materialIds), label: 'حركات مواد لا تتبع مواد موجودة في النسخة' },
      { invalid: findInvalidRef(data.productionOrders, (x) => x.productId, productIds), label: 'أوامر تشغيل لا تتبع منتجات موجودة في النسخة' },
      { invalid: findInvalidRef(data.payments, (x) => x.customerId, customerIds), label: 'سدادات مرتبطة بعملاء غير موجودين في النسخة' },
      { invalid: findInvalidRef(data.payments, (x) => x.supplierId, supplierIds), label: 'سدادات مرتبطة بموردين غير موجودين في النسخة' },
      { invalid: findInvalidRef(data.saleReturns, (x) => x.saleId, salesIds), label: 'مرتجعات مبيعات لا تتبع فواتير موجودة في النسخة' },
      { invalid: findInvalidRef(data.purchaseReturns, (x) => x.purchaseId, purchaseIds), label: 'مرتجعات مشتريات لا تتبع فواتير موجودة في النسخة' },
    ]
    const refError = refChecks.find((c) => c.invalid)
    if (refError) {
      return NextResponse.json(
        { error: `ملف النسخة الاحتياطية غير متوافق — ${refError.label}` },
        { status: 400 },
      )
    }

    // تنبيه غير مانع إذا كانت النسخة منشأة لشركة أخرى (سيتم فرض companyId الحالي عليها)
    const sourceMismatch = typeof body.companyId === 'string' && companyId && body.companyId !== companyId

    // استخدام transaction لضمان إتمام العملية بالكامل أو فشلها بالكامل
    // ⚠️ ملاحظة: جدول users و auditLogs لا يتم مسحهما أو استرجاعهما (حماية الصلاحيات وسجل التدقيق)
    // Fix: كل عمليات الحذف والإنشاء مقيدة بالشركة الحالية فقط
    await db.$transaction(
      async (tx: any) => {
      // معرفات فواتير الشركة لحذف الجداول الفرعية (لا تحتوي companyId)
      const companySales = await tx.sale.findMany({ where: { companyId }, select: { id: true } })
      const companyPurchases = await tx.purchase.findMany({ where: { companyId }, select: { id: true } })
      const saleIds = companySales.map((s: any) => s.id)
      const purchaseIds = companyPurchases.map((p: any) => p.id)

      // حذف بيانات الشركة الحالية فقط بالترتيب الصحيح (للعلاقات)
      // Children first, then parents
      await tx.treasuryTransaction.deleteMany({ where: { companyId } })
      await tx.materialTransaction.deleteMany({ where: { companyId } })
      await tx.expense.deleteMany({ where: { companyId } })
      await tx.expenseCategory.deleteMany({ where: { companyId } })
      await tx.purchaseItem.deleteMany({ where: { purchaseId: { in: purchaseIds } } })
      await tx.purchaseReturn.deleteMany({ where: { companyId } })
      await tx.purchase.deleteMany({ where: { companyId } })
      await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } })
      await tx.saleReturn.deleteMany({ where: { companyId } })
      await tx.sale.deleteMany({ where: { companyId } })
      await tx.payment.deleteMany({ where: { companyId } })
      await tx.productionOrder.deleteMany({ where: { companyId } })
      await tx.production.deleteMany({ where: { companyId } })
      await tx.product.deleteMany({ where: { companyId } })
      await tx.material.deleteMany({ where: { companyId } })
      await tx.supplier.deleteMany({ where: { companyId } })
      await tx.customer.deleteMany({ where: { companyId } })
      await tx.workerAttendance.deleteMany({ where: { companyId } })
      await tx.workerReceipt.deleteMany({ where: { companyId } })
      await tx.workerAdvance.deleteMany({ where: { companyId } })
      await tx.worker.deleteMany({ where: { companyId } })
      await tx.warehouse.deleteMany({ where: { companyId } })
      if (companyId) {
        await tx.factorySettings.deleteMany({ where: { companyId } })
      }

      // إعادة إنشاء البيانات بالترتيب الصحيح (الأصول قبل الأبناء)
      // مع فرض companyId الخاص بالشركة الحالية على كل السجلات

      // FactorySettings
      if (data.factorySettings?.length) {
        for (const s of data.factorySettings) {
          await tx.factorySettings.create({
            data: {
              companyId: s.companyId || s.id || companyId,
              factoryName: s.factoryName,
              factoryNameEn: s.factoryNameEn ?? null,
              slogan: s.slogan ?? null,
              phone: s.phone ?? null,
              whatsapp: s.whatsapp ?? null,
              email: s.email ?? null,
              address: s.address ?? null,
              taxNumber: s.taxNumber ?? null,
              commercialRegister: s.commercialRegister ?? null,
              logo: s.logo ?? null,
              currency: s.currency || 'ج.م',
              invoicePrefix: s.invoicePrefix ?? null,
              invoiceFooter: s.invoiceFooter ?? null,
              defaultPaperSize: s.defaultPaperSize ?? null,
              taxRate: s.taxRate ?? null,
              updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
            },
          })
        }
      }

      // Warehouses
      if (data.warehouses?.length) {
        for (const w of data.warehouses) {
          await tx.warehouse.create({
            data: {
              id: w.id,
              companyId,
              name: w.name,
              type: w.type,
              location: w.location ?? null,
              notes: w.notes ?? null,
              createdAt: new Date(w.createdAt),
            },
          })
        }
      }

      // Products
      if (data.products?.length) {
        for (const p of data.products) {
          await tx.product.create({
            data: {
              id: p.id,
              companyId,
              name: p.name,
              category: p.category ?? null,
              unit: p.unit,
              wholesalePrice: Number(p.wholesalePrice) || 0,
              halfWholesalePrice: Number(p.halfWholesalePrice) || 0,
              retailPrice: Number(p.retailPrice) || 0,
              cost: Number(p.cost) || 0,
              warehouseId: p.warehouseId || null,
              quantity: Number(p.quantity) || 0,
              reorderLevel: p.reorderLevel ?? null,
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
            },
          })
        }
      }

      // Materials
      if (data.materials?.length) {
        for (const m of data.materials) {
          await tx.material.create({
            data: {
              id: m.id,
              companyId,
              name: m.name,
              unit: m.unit,
              warehouseId: m.warehouseId,
              quantity: Number(m.quantity) || 0,
              unitCost: Number(m.unitCost) || 0,
              reorderLevel: m.reorderLevel ?? null,
              notes: m.notes ?? null,
              createdAt: new Date(m.createdAt),
              updatedAt: new Date(m.updatedAt),
            },
          })
        }
      }

      // Customers
      if (data.customers?.length) {
        for (const c of data.customers) {
          await tx.customer.create({
            data: {
              id: c.id,
              companyId,
              name: c.name,
              phone: c.phone ?? null,
              address: c.address ?? null,
              creditLimit: c.creditLimit ?? null,
              loyaltyPoints: c.loyaltyPoints ?? 0,
              openingBalance: c.openingBalance ?? null,
              notes: c.notes ?? null,
              createdAt: new Date(c.createdAt),
            },
          })
        }
      }

      // Suppliers
      if (data.suppliers?.length) {
        for (const s of data.suppliers) {
          await tx.supplier.create({
            data: {
              id: s.id,
              companyId,
              name: s.name,
              phone: s.phone ?? null,
              address: s.address ?? null,
              creditLimit: s.creditLimit ?? null,
              openingBalance: s.openingBalance ?? null,
              notes: s.notes ?? null,
              createdAt: new Date(s.createdAt),
            },
          })
        }
      }

      // Workers
      if (data.workers?.length) {
        for (const w of data.workers) {
          await tx.worker.create({
            data: {
              id: w.id,
              companyId,
              name: w.name,
              phone: w.phone ?? null,
              job: w.job ?? null,
              type: w.type || 'monthly',
              hourlyRate: w.hourlyRate ?? null,
              overtimeRate: w.overtimeRate ?? null,
              workStartTime: w.workStartTime ?? null,
              workHoursPerDay: w.workHoursPerDay ?? null,
              monthlySalary: w.monthlySalary ?? null,
              notes: w.notes ?? null,
              createdAt: new Date(w.createdAt),
              updatedAt: new Date(w.updatedAt),
            },
          })
        }
      }

      // ExpenseCategories
      if (data.expenseCategories?.length) {
        for (const c of data.expenseCategories) {
          await tx.expenseCategory.create({
            data: {
              id: c.id,
              companyId,
              name: c.name,
              notes: c.notes ?? null,
              createdAt: new Date(c.createdAt),
            },
          })
        }
      }

      // Sales
      if (data.sales?.length) {
        for (const s of data.sales) {
          await tx.sale.create({
            data: {
              id: s.id,
              companyId,
              invoiceNo: s.invoiceNo ?? null,
              customerName: s.customerName,
              customerId_ref: s.customerId_ref || null,
              date: new Date(s.date),
              subtotal: Number(s.subtotal) || 0,
              discountType: s.discountType ?? null,
              discountValue: s.discountValue ?? null,
              discountAmount: s.discountAmount ?? null,
              taxRate: s.taxRate ?? null,
              taxAmount: s.taxAmount ?? null,
              extraFees: s.extraFees ?? null,
              total: Number(s.total),
              paid: Number(s.paid),
              notes: s.notes ?? null,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
            },
          })
        }
      }

      // Purchases
      if (data.purchases?.length) {
        for (const p of data.purchases) {
          await tx.purchase.create({
            data: {
              id: p.id,
              companyId,
              invoiceNo: p.invoiceNo ?? null,
              supplierName: p.supplierName,
              supplierId_ref: p.supplierId_ref || null,
              date: new Date(p.date),
              subtotal: Number(p.subtotal) || 0,
              discountType: p.discountType ?? null,
              discountValue: p.discountValue ?? null,
              discountAmount: p.discountAmount ?? null,
              taxRate: p.taxRate ?? null,
              taxAmount: p.taxAmount ?? null,
              extraFees: p.extraFees ?? null,
              total: Number(p.total),
              paid: Number(p.paid),
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
            },
          })
        }
      }

      // Production
      if (data.production?.length) {
        for (const p of data.production) {
          await tx.production.create({
            data: {
              id: p.id,
              companyId,
              workerId: p.workerId,
              date: new Date(p.date),
              modelName: p.modelName,
              quantity: Number(p.quantity),
              unitPrice: Number(p.unitPrice),
              total: Number(p.total),
              productId: p.productId || null,
              addToInventory: p.addToInventory !== false,
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
            },
          })
        }
      }

      // WorkerAdvances
      if (data.workerAdvances?.length) {
        for (const a of data.workerAdvances) {
          await tx.workerAdvance.create({
            data: {
              id: a.id,
              companyId,
              workerId: a.workerId,
              amount: Number(a.amount),
              date: new Date(a.date),
              notes: a.notes ?? null,
              createdAt: new Date(a.createdAt),
            },
          })
        }
      }

      // WorkerReceipts
      if (data.workerReceipts?.length) {
        for (const r of data.workerReceipts) {
          await tx.workerReceipt.create({
            data: {
              id: r.id,
              companyId,
              workerId: r.workerId,
              amount: Number(r.amount),
              date: new Date(r.date),
              notes: r.notes ?? null,
              createdAt: new Date(r.createdAt),
            },
          })
        }
      }

      // WorkerAttendance
      if (data.workerAttendance?.length) {
        for (const a of data.workerAttendance) {
          await tx.workerAttendance.create({
            data: {
              id: a.id,
              companyId,
              workerId: a.workerId,
              date: new Date(a.date),
              checkIn: a.checkIn ? new Date(a.checkIn) : null,
              checkOut: a.checkOut ? new Date(a.checkOut) : null,
              status: a.status || 'present',
              workHours: a.workHours ?? null,
              overtimeHours: a.overtimeHours ?? null,
              lateMinutes: a.lateMinutes ?? null,
              notes: a.notes ?? null,
              createdAt: new Date(a.createdAt),
            },
          })
        }
      }

      // SaleItems (لا تحتوي companyId — تتبع الفاتورة الأب)
      if (data.saleItems?.length) {
        for (const it of data.saleItems) {
          await tx.saleItem.create({
            data: {
              id: it.id,
              saleId: it.saleId,
              itemName: it.itemName,
              productId: it.productId || null,
              priceType: it.priceType ?? null,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.total),
            },
          })
        }
      }

      // PurchaseItems (لا تحتوي companyId — تتبع الفاتورة الأب)
      if (data.purchaseItems?.length) {
        for (const it of data.purchaseItems) {
          await tx.purchaseItem.create({
            data: {
              id: it.id,
              purchaseId: it.purchaseId,
              itemName: it.itemName,
              materialId: it.materialId || null,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.total),
            },
          })
        }
      }

      // Expenses
      if (data.expenses?.length) {
        for (const e of data.expenses) {
          await tx.expense.create({
            data: {
              id: e.id,
              companyId,
              categoryId: e.categoryId,
              categoryName: e.categoryName,
              amount: Number(e.amount),
              date: new Date(e.date),
              notes: e.notes ?? null,
              createdAt: new Date(e.createdAt),
            },
          })
        }
      }

      // TreasuryTransactions
      if (data.treasuryTransactions?.length) {
        for (const t of data.treasuryTransactions) {
          await tx.treasuryTransaction.create({
            data: {
              id: t.id,
              companyId,
              type: t.type,
              amount: Number(t.amount),
              date: new Date(t.date),
              description: t.description,
              category: t.category ?? null,
              referenceType: t.referenceType ?? null,
              referenceId: t.referenceId ?? null,
              notes: t.notes ?? null,
              createdAt: new Date(t.createdAt),
            },
          })
        }
      }

      // MaterialTransactions
      if (data.materialTransactions?.length) {
        for (const mt of data.materialTransactions) {
          await tx.materialTransaction.create({
            data: {
              id: mt.id,
              companyId,
              materialId: mt.materialId,
              warehouseId: mt.warehouseId,
              type: mt.type,
              quantity: Number(mt.quantity),
              unitCost: mt.unitCost ?? null,
              date: new Date(mt.date),
              reason: mt.reason,
              referenceType: mt.referenceType ?? null,
              referenceId: mt.referenceId ?? null,
              notes: mt.notes ?? null,
              createdAt: new Date(mt.createdAt),
            },
          })
        }
      }

      // ProductionOrders
      if (data.productionOrders?.length) {
        for (const po of data.productionOrders) {
          await tx.productionOrder.create({
            data: {
              id: po.id,
              companyId,
              orderNumber: po.orderNumber,
              productId: po.productId,
              productName: po.productName,
              quantity: Number(po.quantity),
              completedQuantity: Number(po.completedQuantity) || 0,
              unit: po.unit,
              status: po.status || 'draft',
              materials: po.materials || [],
              stages: po.stages || [],
              date: new Date(po.date),
              expectedEndDate: po.expectedEndDate ? new Date(po.expectedEndDate) : null,
              completedDate: po.completedDate ? new Date(po.completedDate) : null,
              notes: po.notes ?? null,
              createdAt: new Date(po.createdAt),
              updatedAt: new Date(po.updatedAt),
            },
          })
        }
      }

      // Payments
      if (data.payments?.length) {
        for (const p of data.payments) {
          await tx.payment.create({
            data: {
              id: p.id,
              companyId,
              type: p.type,
              partyId: p.partyId,
              partyName: p.partyName,
              customerId: p.customerId ?? null,
              supplierId: p.supplierId ?? null,
              invoiceId: p.invoiceId ?? null,
              invoiceNo: p.invoiceNo ?? null,
              amount: Number(p.amount),
              date: new Date(p.date),
              method: p.method ?? null,
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
            },
          })
        }
      }

      // SaleReturns
      if (data.saleReturns?.length) {
        for (const sr of data.saleReturns) {
          await tx.saleReturn.create({
            data: {
              id: sr.id,
              companyId,
              returnNumber: sr.returnNumber,
              saleId: sr.saleId,
              invoiceNo: sr.invoiceNo ?? null,
              customerName: sr.customerName,
              customerId_ref: sr.customerId_ref || null,
              date: new Date(sr.date),
              total: Number(sr.total),
              reason: sr.reason ?? null,
              restockItems: sr.restockItems !== false,
              items: sr.items || [],
              notes: sr.notes ?? null,
              createdAt: new Date(sr.createdAt),
            },
          })
        }
      }

      // PurchaseReturns
      if (data.purchaseReturns?.length) {
        for (const pr of data.purchaseReturns) {
          await tx.purchaseReturn.create({
            data: {
              id: pr.id,
              companyId,
              returnNumber: pr.returnNumber,
              purchaseId: pr.purchaseId,
              invoiceNo: pr.invoiceNo ?? null,
              supplierName: pr.supplierName,
              supplierId_ref: pr.supplierId_ref || null,
              date: new Date(pr.date),
              total: Number(pr.total),
              reason: pr.reason ?? null,
              restockItems: pr.restockItems !== false,
              items: pr.items || [],
              notes: pr.notes ?? null,
              createdAt: new Date(pr.createdAt),
            },
          })
        }
      }
      },
      {
        // النسخ الكبيرة تحتاج وقتاً أطول من الافتراضي (5 ثوانٍ)
        maxWait: 15000,
        timeout: 300000,
      },
    )

    return NextResponse.json({
      success: true,
      message: sourceMismatch
        ? 'تم استرجاع البيانات بنجاح — ملاحظة: النسخة أنشئت لشركة أخرى وتم ربطها بشركتك الحالية'
        : 'تم استرجاع بيانات شركتك بنجاح',
      sourceMismatch,
      counts: {
        workers: data.workers?.length || 0,
        workerAdvances: data.workerAdvances?.length || 0,
        workerReceipts: data.workerReceipts?.length || 0,
        workerAttendance: data.workerAttendance?.length || 0,
        production: data.production?.length || 0,
        customers: data.customers?.length || 0,
        suppliers: data.suppliers?.length || 0,
        sales: data.sales?.length || 0,
        saleItems: data.saleItems?.length || 0,
        purchases: data.purchases?.length || 0,
        purchaseItems: data.purchaseItems?.length || 0,
        expenses: data.expenses?.length || 0,
        expenseCategories: data.expenseCategories?.length || 0,
        products: data.products?.length || 0,
        materials: data.materials?.length || 0,
        warehouses: data.warehouses?.length || 0,
        materialTransactions: data.materialTransactions?.length || 0,
        productionOrders: data.productionOrders?.length || 0,
        payments: data.payments?.length || 0,
        saleReturns: data.saleReturns?.length || 0,
        purchaseReturns: data.purchaseReturns?.length || 0,
        treasuryTransactions: data.treasuryTransactions?.length || 0,
        factorySettings: data.factorySettings?.length ? 1 : 0,
      },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
