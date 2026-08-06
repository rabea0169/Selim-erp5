import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    // جلب الفاتورة والتحقق من تبعيتها لشركة المستخدم للحماية من ثغرات IDOR
    const sale = await db.sale.findFirst({
      where: { id, ...(user?.companyId ? { companyId: user.companyId } : {}) },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // 1) إرجاع كميات المنتجات للمخزون
      for (const item of sale.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity }, updatedAt: new Date() },
          })
        }
      }

      // 2) حذف حركة الخزينة المرتبطة (إيداع المبيعات)
      if (sale.paid > 0) {
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale', referenceId: id },
        })
      }

      // 3) حذف المدفوعات المرتبطة بالفاتورة
      await tx.payment.deleteMany({
        where: { invoiceId: id },
      })

      // 4) حذف المرتجعات المرتبطة
      const returnIds = await tx.saleReturn.findMany({
        where: { saleId: id },
        select: { id: true },
      })
      if (returnIds.length > 0) {
        const ids = returnIds.map(r => r.id)
        // حذف حركات الخزينة للمرتجعات
        await tx.treasuryTransaction.deleteMany({
          where: { referenceType: 'sale_return', referenceId: { in: ids } },
        })
        await tx.saleReturn.deleteMany({ where: { id: { in: ids } } })
      }

      // 5) حذف أصناف الفاتورة ثم الفاتورة نفسها
      await tx.saleItem.deleteMany({ where: { saleId: id } })
      await tx.sale.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
