import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withPartyId } from '@/lib/payment-party'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const payment = await db.payment.findFirst({ where: { id, companyId: auth.companyId } })
    if (!payment) {
      return NextResponse.json({ error: 'السداد غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ payment: withPartyId(payment) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existing = await db.payment.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'السداد غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      await tx.treasuryTransaction.deleteMany({
        where: { referenceType: 'payment', referenceId: id, companyId: auth.companyId },
      })
      await tx.payment.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
