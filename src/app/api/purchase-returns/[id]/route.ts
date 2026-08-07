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

// DELETE /api/purchase-returns/[id] — حذف المرتجع مع عكس المخزون والخزينة ذرّياً
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const purchaseReturn = await db.purchaseReturn.findFirst({ where: { id, companyId } })
    if (!purchaseReturn) return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })

    await db.$transaction(async (tx) => {
      // عكس خصم المخزون: الإنشاء خصم الكميات من المواد، الحذف يعيدها
      if (purchaseReturn.restockItems && Array.isArray(purchaseReturn.items)) {
        for (const item of purchaseReturn.items as any[]) {
          if (item?.materialId && Number(item.quantity) > 0) {
            await tx.material.updateMany({
              where: { id: item.materialId, companyId },
              data: { quantity: { increment: Number(item.quantity) }, updatedAt: new Date() },
            })
          }
        }
      }

      // حذف حركة الخزينة المرتبطة — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'purchase_return', referenceId: id, companyId },
      })

      await tx.purchaseReturn.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
