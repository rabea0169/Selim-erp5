import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, notFound } from '@/lib/api'

// GET /api/treasury/:id
export const GET = withAuth<{ id: string }>('read', async ({ auth, params }) => {
  const { id } = params
  const transaction = await db.treasuryTransaction.findFirst({
    where: { id, companyId: auth.companyId },
  })

  if (!transaction) {
    return notFound('المعاملة غير موجودة')
  }

  return NextResponse.json({ transaction })
})

// PUT /api/treasury/:id
export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params
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
    return notFound('المعاملة غير موجودة')
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
})

// DELETE /api/treasury/:id
export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params
  await db.treasuryTransaction.delete({ where: { id, companyId: auth.companyId } })
  return NextResponse.json({ success: true })
})
