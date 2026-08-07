import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/purchase-returns/[id] — جلب مرتجع واحد (مقيد بالشركة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const purchaseReturn = await db.purchaseReturn.findFirst({ where: { id, companyId } })
    if (!purchaseReturn) return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    // الريبو العميل يعيد الاستجابة كما هي (getById)
    return NextResponse.json(purchaseReturn)
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/purchase-returns/[id] — حذف المرتجع مع عكس المخزون (الكمية + متوسط التكلفة) والخزينة ذرّياً
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const purchaseReturn = await db.purchaseReturn.findFirst({ where: { id, companyId } })
    if (!purchaseReturn) return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })

    await db.$transaction(async (tx) => {
      // عكس خصم المخزون: الإنشاء خصم الكميات من المواد مع تعديل متوسط التكلفة،
      // الحذف يعيد الكميات ويعيد حساب متوسط التكلفة المرجح بإضافة قيمة المرتجع
      if (purchaseReturn.restockItems && Array.isArray(purchaseReturn.items)) {
        for (const item of purchaseReturn.items as any[]) {
          if (item?.materialId && Number(item.quantity) > 0) {
            const qty = Number(item.quantity)
            const price = Number(item.unitPrice) || 0
            const mat = await tx.material.findFirst({ where: { id: item.materialId, companyId } })
            if (!mat) throw new Error('المادة غير موجودة')

            const newQuantity = mat.quantity + qty
            // متوسط مرجح بعد إرجاع الكمية بسعرها الأصلي في المرتجع
            const newUnitCost = newQuantity > 0
              ? (mat.quantity * mat.unitCost + qty * price) / newQuantity
              : 0

            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: newQuantity, unitCost: newUnitCost, updatedAt: new Date() },
            })
          }
        }

        // حذف حركات المواد المرتبطة بهذا المرتجع
        await tx.materialTransaction.deleteMany({
          where: { referenceType: 'purchase_return', referenceId: id, companyId },
        })
      }

      // حذف حركة الخزينة المرتبطة — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'purchase_return', referenceId: id, companyId },
      })

      await tx.purchaseReturn.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجود')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
