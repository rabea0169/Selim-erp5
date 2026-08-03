import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const tx = await db.$transaction(async (tx) => {
      const prod = await tx.production.findUnique({ where: { id }, include: { product: true } })
      if (!prod) return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })

      // Revert inventory if it was added
      if (prod.addToInventory !== false && prod.productId && prod.product) {
        await tx.product.update({
          where: { id: prod.productId },
          data: { quantity: { decrement: prod.quantity } },
        })
      }

      await tx.production.delete({ where: { id } })
      return prod
    })

    if (tx instanceof NextResponse) return tx
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
