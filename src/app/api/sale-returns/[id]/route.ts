import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/sale-returns/[id] — جلب مرتجع واحد (مقيد بالشركة)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const saleReturn = await db.saleReturn.findFirst({ where: { id, companyId } })
    if (!saleReturn) return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    // الريبو العميل يعيد الاستجابة كما هي (getById)
    return NextResponse.json(saleReturn)
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/sale-returns/[id] — حذف المرتجع مع عكس المخزون والخزينة ذرّياً
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params

    const saleReturn = await db.saleReturn.findFirst({ where: { id, companyId } })
    if (!saleReturn) return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })

    await db.$transaction(async (tx) => {
      // عكس إعادة المخزون إن كان المرتجع قد أعاد الأصناف
      if (saleReturn.restockItems && Array.isArray(saleReturn.items)) {
        for (const item of saleReturn.items as any[]) {
          if (item?.productId && Number(item.quantity) > 0) {
            const product = await tx.product.findFirst({ where: { id: item.productId, companyId } })
            if (!product) throw new Error('المنتج غير موجود')
            if (product.quantity < Number(item.quantity)) {
              throw new Error(`لا يمكن حذف المرتجع: كمية المنتج (${product.name}) المتاحة (${product.quantity}) أقل من كمية المرتجع (${Number(item.quantity)})`)
            }
            await tx.product.updateMany({
              where: { id: item.productId, companyId },
              data: { quantity: { decrement: Number(item.quantity) }, updatedAt: new Date() },
            })
          }
        }
      }

      // حذف حركة الخزينة المرتبطة — داخل الشركة فقط
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'sale_return', referenceId: id, companyId },
      })

      await tx.saleReturn.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود') || e.message.includes('لا يمكن حذف'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
