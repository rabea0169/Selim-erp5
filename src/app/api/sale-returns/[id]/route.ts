import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const saleReturn = await db.saleReturn.findFirst({ where: { id, companyId: auth.companyId } })
    if (!saleReturn) {
      return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ return: saleReturn })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existing = await db.saleReturn.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    }

    // إلغاء المرتجع يعكس أثره على المخزون
    await db.$transaction(async (tx) => {
      if (existing.restockItems) {
        for (const it of (existing.items as any[]) || []) {
          if (!it.productId) continue
          await tx.product.updateMany({
            where: { id: it.productId, companyId: auth.companyId },
            data: { quantity: { decrement: Number(it.quantity) } },
          })
        }
      }
      await tx.saleReturn.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
