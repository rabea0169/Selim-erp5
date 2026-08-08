import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params
    let notFound = false

    await db.$transaction(async (tx: any) => {
      const prod = await tx.production.findFirst({ where: { id, companyId }, include: { product: true } })
      if (!prod) { notFound = true; return }

      // Revert inventory if it was added
      if (prod.addToInventory !== false && prod.productId && prod.product) {
        if (prod.product.quantity < prod.quantity) {
          throw new Error(`لا يمكن الحذف - كمية المنتج (${prod.product.quantity}) أقل من كمية الإنتاج (${prod.quantity})`)
        }
        await tx.product.update({
          where: { id: prod.productId },
          data: { quantity: { decrement: prod.quantity }, updatedAt: new Date() },
        })
      }

      await tx.production.delete({ where: { id } })
    })

    if (notFound) return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message.includes('لا يمكن الحذف')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
