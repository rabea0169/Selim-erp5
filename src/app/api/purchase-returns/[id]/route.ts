import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const purchaseReturn = await db.purchaseReturn.findFirst({ where: { id, companyId: auth.companyId } })
    if (!purchaseReturn) {
      return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ return: purchaseReturn })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existing = await db.purchaseReturn.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المرتجع غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      for (const it of (existing.items as any[]) || []) {
        if (!it.materialId) continue
        await tx.material.updateMany({
          where: { id: it.materialId, companyId: auth.companyId },
          data: { quantity: { increment: Number(it.quantity) } },
        })
      }
      await tx.purchaseReturn.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
