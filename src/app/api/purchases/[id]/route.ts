import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'
import { assertValidPaid, weightedAverageCost } from '@/lib/calc'

// GET /api/purchases/[id] — جلب فاتورة شراء واحدة (معزولة بالشركة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params

    const purchase = await db.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!purchase) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }
    return NextResponse.json({ purchase })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

// حساب الكميات المُرتجعة سابقاً لكل مادة من مرتجعات الفاتورة (restockItems=true)
// items مخزنة كـ JSON في PurchaseReturn — كل عنصر: { itemName, materialId?, quantity, unitPrice }
async function getReturnedQtyByMaterial(tx: any, purchaseId: string, companyId: string | null) {
  const returnedQty = new Map<string, number>()
  const returns = await tx.purchaseReturn.findMany({
    where: { purchaseId, companyId, restockItems: true },
    select: { items: true },
  })
  for (const r of returns) {
    const rItems = Array.isArray(r.items) ? (r.items as any[]) : []
    for (const ri of rItems) {
      if (ri?.materialId && Number(ri.quantity) > 0) {
        returnedQty.set(ri.materialId, (returnedQty.get(ri.materialId) || 0) + Number(ri.quantity))
      }
    }
  }
  return returnedQty
}

// عكس مخزون صنف فاتورة (خصم الكمية + إعادة حساب متوسط التكلفة + تسجيل حركة مادة)
async function reversePurchaseItemStock(
  tx: any,
  item: { materialId: string | null; quantity: number; unitPrice: number },
  qtyToReverse: number,
  companyId: string | null,
  reason: string,
  referenceType: string,
  referenceId: string
) {
  if (!item.materialId || qtyToReverse <= 0) return
  const mat = await tx.material.findFirst({ where: { id: item.materialId, companyId } })
  if (!mat) return

  const removedValue = qtyToReverse * item.unitPrice
  const totalOldValue = mat.quantity * mat.unitCost
  const remainingQuantity = mat.quantity - qtyToReverse

  // إعادة حساب تكلفة الوحدة المرجحة بعد إزالة قيمة الكمية المعكوسة
  const newUnitCost = remainingQuantity > 0
    ? Math.max(0, (totalOldValue - removedValue)) / remainingQuantity
    : 0

  await tx.material.update({
    where: { id: item.materialId },
    data: {
      quantity: Math.max(0, mat.quantity - qtyToReverse),
      unitCost: newUnitCost,
      updatedAt: new Date(),
    },
  })

  await tx.materialTransaction.create({
    data: {
      companyId,
      materialId: item.materialId,
      warehouseId: mat.warehouseId,
      type: 'out',
      quantity: qtyToReverse,
      unitCost: item.unitPrice,
      date: new Date(),
      reason,
      referenceType,
      referenceId,
    },
  })
}

// PUT /api/purchases/[id] — تحديث المدفوع/الملاحظات أو تعديل الفاتورة كاملة (بيانات + أصناف)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params
    const body = await req.json()

    // فحص وجود الفاتورة وتبعيتها للشركة (حماية IDOR)
    const existing = await db.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }

    // ===== وضع التعديل الكامل: بيانات الفاتورة + الأصناف =====
    if (Array.isArray(body.items)) {
      const { supplierName, supplierId_ref, invoiceNo, date, notes } = body

      if (!supplierName?.trim()) {
        return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
      }
      if (!date) {
        return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
      }
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 })
      }

      const validItems = (body.items as any[]).filter(
        (it: any) => it.itemName?.trim() && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0
      )
      if (validItems.length === 0) {
        return NextResponse.json({ error: 'أضف صنفاً صحيحاً واحداً على الأقل' }, { status: 400 })
      }

      // إعادة حساب الإجمالي في السيرفر (مجموع الأصناف)
      const total = validItems.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0)
      const paidAmount = body.paid !== undefined ? Number(body.paid) : existing.paid
      if (isNaN(paidAmount)) {
        return NextResponse.json({ error: 'المبلغ المدفوع غير صالح' }, { status: 400 })
      }
      const paidError = assertValidPaid(paidAmount, total)
      if (paidError) {
        return NextResponse.json({ error: paidError }, { status: 400 })
      }

      const purchase = await db.$transaction(async (tx: any) => {
        // فحص المواد والمورد داخل الـ transaction — مع عزل الشركة
        for (const it of validItems) {
          if (it.materialId) {
            const material = await tx.material.findFirst({ where: { id: it.materialId, companyId } })
            if (!material) {
              throw new Error(`المادة "${it.itemName}" غير موجودة في قاعدة البيانات`)
            }
          }
        }
        if (supplierId_ref) {
          const supplier = await tx.supplier.findFirst({ where: { id: supplierId_ref, companyId } })
          if (!supplier) {
            throw new Error('المورد المحدد غير موجود')
          }
        }

        // 1) عكس مخزون المواد القديمة — صافي الكمية بعد خصم المُرتجع سابقاً (تجنب الخصم المزدوج)
        const returnedQty = await getReturnedQtyByMaterial(tx, id, companyId)
        const editReason = `تعديل فاتورة شراء${existing.invoiceNo ? ` ${existing.invoiceNo}` : ''}`
        for (const item of existing.items) {
          if (item.materialId) {
            const netQty = Math.max(0, item.quantity - (returnedQty.get(item.materialId) || 0))
            await reversePurchaseItemStock(tx, item, netQty, companyId, editReason, 'purchase_edit', id)
          }
        }

        // 2) حذف العناصر القديمة
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })

        // 3) تحديث بيانات الفاتورة وإنشاء العناصر الجديدة
        const updated = await tx.purchase.update({
          where: { id: existing.id },
          data: {
            supplierName: supplierName.trim(),
            supplierId_ref: supplierId_ref || null,
            invoiceNo: invoiceNo?.trim() || null,
            date: dateObj,
            subtotal: total,
            discountType: null,
            discountValue: 0,
            discountAmount: 0,
            taxRate: null,
            taxAmount: 0,
            extraFees: 0,
            total,
            paid: paidAmount,
            notes: notes?.trim() || null,
            items: {
              create: validItems.map((it: any) => ({
                itemName: it.itemName.trim(),
                materialId: it.materialId || null,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
                total: Number(it.quantity) * Number(it.unitPrice),
              })),
            },
          },
          include: { items: true },
        })

        // 4) إضافة مخزون المواد الجديدة بمتوسط التكلفة المرجح (نفس نمط POST)
        for (const it of validItems) {
          if (it.materialId) {
            const material = await tx.material.findFirst({ where: { id: it.materialId, companyId } })
            if (material) {
              const newUnitCost = weightedAverageCost(
                material.quantity,
                material.unitCost,
                Number(it.quantity),
                Number(it.unitPrice)
              )

              await tx.material.update({
                where: { id: it.materialId },
                data: {
                  quantity: { increment: Number(it.quantity) },
                  unitCost: newUnitCost,
                  updatedAt: new Date(),
                },
              })

              await tx.materialTransaction.create({
                data: {
                  companyId,
                  materialId: it.materialId,
                  warehouseId: material.warehouseId,
                  type: 'in',
                  quantity: Number(it.quantity),
                  unitCost: Number(it.unitPrice),
                  date: dateObj,
                  reason: `شراء - ${supplierName.trim()}${invoiceNo ? ` (فاتورة ${invoiceNo})` : ''}`,
                  referenceType: 'purchase',
                  referenceId: id,
                },
              })
            }
          }
        }

        return updated
      })

      return NextResponse.json({ purchase })
    }

    // ===== وضع التحديث البسيط: المدفوع/الملاحظات/رقم الفاتورة فقط =====
    const data: any = {}

    if (body.paid !== undefined) {
      const newPaid = Number(body.paid)
      if (isNaN(newPaid)) {
        return NextResponse.json({ error: 'المبلغ المدفوع غير صالح' }, { status: 400 })
      }
      // منع paid > total و paid سالب
      const paidError = assertValidPaid(newPaid, existing.total)
      if (paidError) {
        return NextResponse.json({ error: paidError }, { status: 400 })
      }
      data.paid = newPaid
    }

    if (body.notes !== undefined) {
      data.notes = body.notes?.trim() || null
    }
    if (body.invoiceNo !== undefined) {
      data.invoiceNo = body.invoiceNo?.trim() || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'لا توجد حقول للتحديث' }, { status: 400 })
    }

    const purchase = await db.purchase.update({
      where: { id: existing.id },
      data,
      include: { items: true },
    })
    return NextResponse.json({ purchase })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('المادة') || e.message.includes('المورد'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params

    const purchase = await db.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!purchase) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }

    await db.$transaction(async (tx: any) => {
      // 1) إرجاع كميات المواد الخام مع إعادة حساب متوسط التكلفة المرجح (GAP-04 fix)
      //    إصلاح الخصم المزدوج: المرتجعات (restockItems=true) سبق أن خصمت كمياتها من المخزون،
      //    لذا نعكس فقط صافي الكمية = كمية الفاتورة − الكميات المُرتجعة سابقاً لنفس المادة
      const returnedQty = await getReturnedQtyByMaterial(tx, id, companyId)
      for (const item of purchase.items) {
        if (item.materialId) {
          const netQty = Math.max(0, item.quantity - (returnedQty.get(item.materialId) || 0))
          await reversePurchaseItemStock(
            tx,
            item,
            netQty,
            companyId,
            `حذف فاتورة شراء${purchase.invoiceNo ? ` ${purchase.invoiceNo}` : ''}`,
            'purchase_delete',
            id
          )
        }
      }

      // 2) حذف حركة الخزينة المرتبطة (سحب المشتريات) — داخل الشركة فقط
      if (purchase.paid > 0) {
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'purchase', referenceId: id, companyId },
        })
      }

      // 3) حذف المدفوعات المرتبطة
      await tx.payment.deleteMany({
        where: { invoiceId: id, companyId },
      })

      // 4) حذف المرتجعات المرتبطة
      const returnIds = await tx.purchaseReturn.findMany({
        where: { purchaseId: id, companyId },
        select: { id: true },
      })
      if (returnIds.length > 0) {
        const ids = returnIds.map((r: any) => r.id)
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'purchase_return', referenceId: { in: ids }, companyId },
        })
        await tx.purchaseReturn.deleteMany({ where: { id: { in: ids } } })
      }

      // 5) حذف حركات المواد المرتبطة بالشراء
      await tx.materialTransaction.deleteMany({
        where: { referenceType: 'purchase', referenceId: id, companyId },
      })

      // 6) حذف أصناف الشراء ثم الفاتورة
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
      await tx.purchase.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
