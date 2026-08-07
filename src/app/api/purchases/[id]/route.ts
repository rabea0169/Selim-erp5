import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const purchase = await db.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!purchase) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) إرجاع كميات المواد الخام مع إعادة حساب متوسط التكلفة المرجح (GAP-04 fix)
      for (const item of purchase.items) {
        if (item.materialId) {
          const mat = await tx.material.findFirst({ where: { id: item.materialId, companyId } })
          if (mat) {
            const removedValue = item.quantity * item.unitPrice
            const totalOldValue = mat.quantity * mat.unitCost
            const remainingQuantity = mat.quantity - item.quantity

            // إعادة حساب تكلفة الوحدة المرجحة بعد إزالة قيمة الصنف المحذوف
            const newUnitCost = remainingQuantity > 0
              ? Math.max(0, (totalOldValue - removedValue)) / remainingQuantity
              : 0

            await tx.material.update({
              where: { id: item.materialId },
              data: {
                quantity: Math.max(0, mat.quantity - item.quantity),
                unitCost: newUnitCost,
                updatedAt: new Date(),
              },
            })

            // تسجيل حركة مرتجع للمادة
            await tx.materialTransaction.create({
              data: {
                companyId,
                materialId: item.materialId,
                warehouseId: mat.warehouseId,
                type: 'out',
                quantity: item.quantity,
                unitCost: item.unitPrice,
                date: new Date(),
                reason: `حذف فاتورة شراء${purchase.invoiceNo ? ` ${purchase.invoiceNo}` : ''}`,
                referenceType: 'purchase_delete',
                referenceId: id,
              },
            })
          }
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
        const ids = returnIds.map(r => r.id)
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
