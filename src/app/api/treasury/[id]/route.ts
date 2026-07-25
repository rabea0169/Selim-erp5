import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

// GET /api/treasury/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const transaction = await db.treasuryTransaction.findFirst({
      where: { id, companyId: auth.companyId },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json({ transaction })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/treasury/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await req.json()
    const {
      type,
      amount,
      date,
      description,
      category,
      referenceType,
      referenceId,
      notes,
    } = body

    const existing = await db.treasuryTransaction.findFirst({
      where: { id, companyId: auth.companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
    }

    const transaction = await db.treasuryTransaction.update({
      where: { id },
      data: {
        ...(type?.trim() && { type: type.trim() }),
        ...(amount != null && { amount: Number(amount) }),
        ...(date && { date: new Date(date) }),
        ...(description?.trim() && { description: description.trim() }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(referenceType !== undefined && { referenceType: referenceType?.trim() || null }),
        ...(referenceId !== undefined && { referenceId: referenceId?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })

    return NextResponse.json({ transaction })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/treasury/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    await db.treasuryTransaction.delete({ where: { id, companyId: auth.companyId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
