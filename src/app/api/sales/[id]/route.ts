import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const sale = await db.sale.findFirst({
      where: { id, companyId: auth.companyId },
      include: { items: true },
    })
    if (!sale) {
      return NextResponse.json({ error: 'الفاتورة غير موجودة' }, { status: 404 })
    }

    // حذف الفاتورة يعكس أثرها على المخزون والخزينة
    await db.$transaction(async (tx) => {
      for (const item of sale.items) {
        if (!item.productId) continue
        await tx.product.updateMany({
          where: { id: item.productId, companyId: auth.companyId },
          data: { quantity: { increment: item.quantity } },
        })
      }
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'sale', referenceId: sale.id, companyId: auth.companyId },
      })
      await tx.sale.delete({ where: { id: sale.id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
