import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/production-orders/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await db.productionOrder.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ productionOrder: order })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

// PUT /api/production-orders/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { orderNumber, productId, productName, quantity, completedQuantity, unit, status, materials, stages, date, expectedEndDate, completedDate, notes } = body

    const existing = await db.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    if (productId && productId !== existing.productId) {
      const product = await db.product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json({ error: 'المنتج المحدد غير موجود' }, { status: 404 })
      }
    }

    // ===== ربط دورة الإنتاج بالمخزون =====
    // عند تغيير الحالة نتعامل مع المخزون
    const newStatus = status || existing.status
    const finalCompletedQuantity = completedQuantity != null ? Number(completedQuantity) : existing.completedQuantity

    const order = await db.$transaction(async (tx) => {
      // 1) عند بدء أمر التشغيل (draft → in_progress): سحب المواد الخام من المخزن
      if (newStatus === 'in_progress' && existing.status === 'draft') {
        const orderMaterials = (materials !== undefined ? materials : existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
        for (const mat of orderMaterials) {
          if (!mat.materialId) continue

          const material = await tx.material.findUnique({ where: { id: mat.materialId } })
          if (!material) {
            throw new Error(`المادة ${mat.materialName} غير موجودة`)
          }
          if (material.quantity < mat.quantity) {
            throw new Error(`الكمية المتاحة من ${mat.materialName} (${material.quantity}) أقل من المطلوب (${mat.quantity})`)
          }

          // سحب الكمية من المادة الخام
          await tx.material.update({
            where: { id: mat.materialId },
            data: { quantity: { decrement: mat.quantity }, updatedAt: new Date() },
          })

          // تسجيل حركة السحب
          await tx.materialTransaction.create({
            data: {
              materialId: mat.materialId,
              warehouseId: material.warehouseId,
              type: 'out',
              quantity: mat.quantity,
              unitCost: material.unitCost,
              date: new Date(),
              reason: `أمر تشغيل ${existing.orderNumber}`,
              referenceType: 'production_order',
              referenceId: id,
              notes: `سحب لإنتاج ${existing.productName}`,
            },
          })
        }
      }

      // 2) عند إكمال أمر التشغيل: إضافة الكمية المنتهية لمنتج المخزن
      if (newStatus === 'completed' && existing.status !== 'completed') {
        // F3-03 fix: منع إكمال بكمية أكبر من المطلوب
        if (finalCompletedQuantity > existing.quantity) {
          throw new Error(`الكمية المنتهية (${finalCompletedQuantity}) تتجاوز الكمية المطلوبة (${existing.quantity})`)
        }
        if (finalCompletedQuantity <= 0) {
          throw new Error('الكمية المنتهية يجب أن تكون أكبر من صفر')
        }
        if (finalCompletedQuantity > 0) {
          await tx.product.update({
            where: { id: existing.productId },
            data: {
              quantity: { increment: finalCompletedQuantity },
              updatedAt: new Date(),
            },
          })
        }
      }

      // 3) عند إلغاء أمر التشغيل: إرجاع المواد الخام للمخزن
      if (newStatus === 'cancelled' && (existing.status === 'in_progress' || existing.status === 'draft')) {
        // إرجاع المواد فقط لو كان قد تم سحبها فعلاً (status was in_progress)
        if (existing.status === 'in_progress') {
          const orderMaterials = (existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
          for (const mat of orderMaterials) {
            if (!mat.materialId) continue

            const material = await tx.material.findUnique({ where: { id: mat.materialId } })
            if (!material) continue

            await tx.material.update({
              where: { id: mat.materialId },
              data: { quantity: { increment: mat.quantity }, updatedAt: new Date() },
            })

            await tx.materialTransaction.create({
              data: {
                materialId: mat.materialId,
                warehouseId: material.warehouseId,
                type: 'in',
                quantity: mat.quantity,
                unitCost: material.unitCost,
                date: new Date(),
                reason: `إلغاء أمر تشغيل ${existing.orderNumber}`,
                referenceType: 'production_order',
                referenceId: id,
                notes: `إرجاع مادة ${mat.materialName} بسبب إلغاء أمر التشغيل`,
              },
            })
          }
        }
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          orderNumber: orderNumber?.trim() || existing.orderNumber,
          productId: productId || existing.productId,
          productName: productName?.trim() || existing.productName,
          quantity: quantity != null ? Number(quantity) : existing.quantity,
          completedQuantity: finalCompletedQuantity,
          unit: unit?.trim() || existing.unit,
          status: newStatus,
          materials: materials !== undefined ? materials : existing.materials,
          stages: stages !== undefined ? stages : existing.stages,
          date: date ? new Date(date) : existing.date,
          expectedEndDate: expectedEndDate !== undefined ? (expectedEndDate ? new Date(expectedEndDate) : null) : existing.expectedEndDate,
          completedDate: completedDate !== undefined ? (completedDate ? new Date(completedDate) : null) : existing.completedDate,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        },
      })
      return updated
    })
    return NextResponse.json({ productionOrder: order })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود') || e.message.includes('أقل من المطلوب') || e.message.includes('تتجاوز') || e.message.includes('أكبر من صفر'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/production-orders/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) لو كان in_progress: إرجاع المواد الخام
      if (existing.status === 'in_progress') {
        const orderMaterials = (existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
        for (const mat of orderMaterials) {
          if (!mat.materialId) continue
          const material = await tx.material.findUnique({ where: { id: mat.materialId } })
          if (!material) continue
          await tx.material.update({
            where: { id: mat.materialId },
            data: { quantity: { increment: mat.quantity }, updatedAt: new Date() },
          })
          await tx.materialTransaction.create({
            data: {
              materialId: mat.materialId,
              warehouseId: material.warehouseId,
              type: 'in',
              quantity: mat.quantity,
              unitCost: material.unitCost,
              date: new Date(),
              reason: `حذف أمر تشغيل ${existing.orderNumber}`,
              referenceType: 'production_order_delete',
              referenceId: id,
              notes: `إرجاع مادة ${mat.materialName} بسبب حذف أمر التشغيل`,
            },
          })
        }
      }

      // 2) لو كان completed: إزالة الكمية المنتجة من مخزون المنتج
      if (existing.status === 'completed' && existing.completedQuantity > 0) {
        await tx.product.update({
          where: { id: existing.productId },
          data: { quantity: { decrement: existing.completedQuantity }, updatedAt: new Date() },
        })
      }

      // 3) حذف حركات المواد المرتبطة بهذا الأمر
      await tx.materialTransaction.deleteMany({
        where: { referenceType: 'production_order', referenceId: id },
      })

      // 4) حذف أمر التشغيل
      await tx.productionOrder.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
