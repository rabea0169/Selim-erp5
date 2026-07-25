import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const purchase = await db.purchase.findFirst({
      where: { id, companyId: auth.companyId },
      include: { items: true },
    })
    if (!purchase) {
      return NextResponse.json({ error: 'فاتورة الشراء غير موجودة' }, { status: 404 })
    }

    // حذف الفاتورة يعكس أثرها على المخزون والخزينة
    await db.$transaction(async (tx) => {
      for (const item of purchase.items) {
        if (!item.materialId) continue
        await tx.material.updateMany({
          where: { id: item.materialId, companyId: auth.companyId },
          data: { quantity: { decrement: item.quantity } },
        })
      }
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'purchase', referenceId: purchase.id, companyId: auth.companyId },
      })
      await tx.purchase.delete({ where: { id: purchase.id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
