import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/production-orders/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const { id } = await params
    const order = await db.productionOrder.findFirst({
      where: { id, companyId: user.companyId ?? null },
    })
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
// يدعم إجراءات الواجهة: action = startStage | completeStage | completeOrder
// وكذلك التحديث المباشر للحقول (مثل إلغاء الأمر status=cancelled)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { action, stageId, workerId, orderNumber, productId, productName, quantity, completedQuantity, unit, status, materials, stages, date, expectedEndDate, completedDate, notes } = body

    const existing = await db.productionOrder.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    // حماية دورة الحياة: منع تعديل/إكمال أمر ملغي (يسمح فقط بتعديل ملاحظات/تواريخ بدون تغيير الحالة)
    if (existing.status === 'cancelled' && (action || (status && status !== 'cancelled'))) {
      return NextResponse.json({ error: 'لا يمكن تعديل أو إكمال أمر ملغي' }, { status: 400 })
    }
    // منع إلغاء أمر مكتمل — كمية المنتج أُضيفت للمخزون بالفعل (الحذف يعكس الأثر بشكل صحيح)
    if (existing.status === 'completed' && status === 'cancelled') {
      return NextResponse.json({ error: 'لا يمكن إلغاء أمر مكتمل — يمكن حذفه لعكس أثره على المخزون' }, { status: 400 })
    }

    if (productId && productId !== existing.productId) {
      const product = await db.product.findFirst({ where: { id: productId, companyId } })
      if (!product) {
        return NextResponse.json({ error: 'المنتج المحدد غير موجود' }, { status: 404 })
      }
    }

    // ===== ربط دورة الإنتاج بالمخزون =====
    let newStatus = status || existing.status
    let finalCompletedQuantity = completedQuantity != null ? Number(completedQuantity) : existing.completedQuantity
    let finalStages: any = stages !== undefined ? stages : existing.stages
    let finalCompletedDate: Date | null | undefined =
      completedDate !== undefined ? (completedDate ? new Date(completedDate) : null) : existing.completedDate

    // ===== معالجة الإجراءات القادمة من الواجهة =====
    if (action === 'startStage' || action === 'completeStage') {
      const list = (existing.stages as Array<{ id?: string; name: string; status: string; startedAt?: string; completedAt?: string; workerId?: string }>) || []
      const idx = list.findIndex((s, i) =>
        (s.id && s.id === stageId) || (!s.id && String(i) === String(stageId))
      )
      if (idx === -1) {
        return NextResponse.json({ error: 'المرحلة غير موجودة' }, { status: 404 })
      }
      const stage = list[idx]
      if (action === 'startStage' && stage.status !== 'pending') {
        return NextResponse.json({ error: 'لا يمكن بدء مرحلة ليست في الانتظار' }, { status: 400 })
      }
      if (action === 'completeStage' && stage.status !== 'in_progress') {
        return NextResponse.json({ error: 'لا يمكن إكمال مرحلة لم تبدأ' }, { status: 400 })
      }
      const nowIso = new Date().toISOString()
      finalStages = list.map((s, i) => {
        const withId = s.id ? s : { ...s, id: `stage-${i + 1}` }
        if (i !== idx) return withId
        if (action === 'startStage') {
          return { ...withId, status: 'in_progress', startedAt: nowIso, workerId: workerId || s.workerId }
        }
        return { ...withId, status: 'completed', completedAt: nowIso, workerId: workerId || s.workerId }
      })
      // بدء أول مرحلة في مسودة ينقل الأمر إلى قيد التنفيذ (مع سحب المواد إن وجدت)
      if (action === 'startStage' && existing.status === 'draft') {
        newStatus = 'in_progress'
      }
    } else if (action === 'completeOrder') {
      const qty = Number(completedQuantity)
      if (completedQuantity == null || isNaN(qty) || qty <= 0) {
        return NextResponse.json({ error: 'الكمية المنتهية يجب أن تكون أكبر من صفر' }, { status: 400 })
      }
      newStatus = 'completed'
      finalCompletedQuantity = qty
      finalCompletedDate = new Date()
    } else if (action) {
      return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
    }

    const order = await db.$transaction(async (tx) => {
      // 1) سحب المواد الخام من المخزن — مرة واحدة فقط في دورة الحياة:
      //    عند بدء المسودة (draft → in_progress)، أو عند إكمال مسودة مباشرة دون بدء
      //    (مسودة بمواد لم تُسحب — وإلا أُضيف المنتج للمخزون دون استهلاك المواد)
      const shouldConsumeMaterials =
        (newStatus === 'in_progress' && existing.status === 'draft') ||
        (action === 'completeOrder' && existing.status === 'draft')
      if (shouldConsumeMaterials) {
        const orderMaterials = (materials !== undefined ? materials : existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
        for (const mat of orderMaterials) {
          if (!mat.materialId) continue

          const material = await tx.material.findFirst({ where: { id: mat.materialId, companyId } })
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
              companyId,
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
      //    idempotent: الشرط existing.status !== 'completed' يمنع الإضافة المزدوجة عند إعادة الضغط
      if (newStatus === 'completed' && existing.status !== 'completed') {
        // F3-03 fix: منع إكمال بكمية أكبر من المطلوب
        if (finalCompletedQuantity > existing.quantity) {
          throw new Error(`الكمية المنتهية (${finalCompletedQuantity}) تتجاوز الكمية المطلوبة (${existing.quantity})`)
        }
        if (finalCompletedQuantity <= 0) {
          throw new Error('الكمية المنتهية يجب أن تكون أكبر من صفر')
        }
        await tx.product.update({
          where: { id: existing.productId },
          data: {
            quantity: { increment: finalCompletedQuantity },
            updatedAt: new Date(),
          },
        })
      }

      // 3) عند إلغاء أمر التشغيل: إرجاع المواد الخام للمخزن
      if (newStatus === 'cancelled' && (existing.status === 'in_progress' || existing.status === 'draft')) {
        // إرجاع المواد فقط لو كان قد تم سحبها فعلاً (status was in_progress)
        if (existing.status === 'in_progress') {
          const orderMaterials = (existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
          for (const mat of orderMaterials) {
            if (!mat.materialId) continue

            const material = await tx.material.findFirst({ where: { id: mat.materialId, companyId } })
            if (!material) continue

            await tx.material.update({
              where: { id: mat.materialId },
              data: { quantity: { increment: mat.quantity }, updatedAt: new Date() },
            })

            await tx.materialTransaction.create({
              data: {
                companyId,
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
          stages: finalStages,
          date: date ? new Date(date) : existing.date,
          expectedEndDate: expectedEndDate !== undefined ? (expectedEndDate ? new Date(expectedEndDate) : null) : existing.expectedEndDate,
          completedDate: finalCompletedDate,
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
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const existing = await db.productionOrder.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) لو كان in_progress: إرجاع المواد الخام
      if (existing.status === 'in_progress') {
        const orderMaterials = (existing.materials) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }> || []
        for (const mat of orderMaterials) {
          if (!mat.materialId) continue

          const material = await tx.material.findFirst({ where: { id: mat.materialId, companyId } })
          if (!material) continue

          await tx.material.update({
            where: { id: mat.materialId },
            data: { quantity: { increment: mat.quantity }, updatedAt: new Date() },
          })
        }
      }

      // 2) لو كان completed: إزالة الكمية المنتجة من مخزون المنتج — مع فحص الكفاية
      //    المنتجات ليس لها حركات مخزن في الـ schema، فالخيار الآمن هو منع الحذف إن كان
      //    الخصم سيجعل مخزون المنتج سالباً (باع العميل جزءاً من الكمية مثلاً)
      if (existing.status === 'completed' && existing.completedQuantity > 0) {
        const product = await tx.product.findFirst({ where: { id: existing.productId, companyId } })
        if (!product) {
          throw new Error('المنتج المرتبط بأمر التشغيل غير موجود — لا يمكن عكس أثر المخزون')
        }
        if (product.quantity < existing.completedQuantity) {
          throw new Error(
            `لا يمكن حذف الأمر: خصم الكمية المنتجة (${existing.completedQuantity}) سيجعل مخزون المنتج سالباً (المتاح حالياً ${product.quantity})`
          )
        }
        await tx.product.update({
          where: { id: existing.productId },
          data: { quantity: { decrement: existing.completedQuantity }, updatedAt: new Date() },
        })
      }

      // 3) حذف حركات المواد المرتبطة بهذا الأمر — داخل الشركة فقط
      await tx.materialTransaction.deleteMany({
        where: { referenceType: 'production_order', referenceId: id, companyId },
      })

      // 4) حذف أمر التشغيل
      await tx.productionOrder.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود') || e.message.includes('سالباً'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
