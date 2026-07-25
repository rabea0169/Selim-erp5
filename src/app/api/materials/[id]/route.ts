import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, notFound } from '@/lib/api'

// GET /api/materials/[id]
export const GET = withAuth<{ id: string }>('read', async ({ auth, params }) => {
  const { id } = params

  const material = await db.material.findFirst({
    where: { id, companyId: auth.companyId },
    include: { warehouse: true },
  })
  if (!material) {
    return notFound('المادة غير موجودة')
  }
  return NextResponse.json({ material })
})

// PUT /api/materials/[id]
export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params

  const body = await req.json()
  const existing = await db.material.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المادة غير موجودة')
  }

  const material = await db.material.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      unit: body.unit?.trim() ?? existing.unit,
      warehouseId: body.warehouseId ?? existing.warehouseId,
      quantity: body.quantity != null ? Number(body.quantity) : existing.quantity,
      unitCost: body.unitCost != null ? Number(body.unitCost) : existing.unitCost,
      reorderLevel: body.reorderLevel != null ? Number(body.reorderLevel) : existing.reorderLevel,
      notes: body.notes?.trim() ?? existing.notes,
    },
  })
  return NextResponse.json({ material })
})

// DELETE /api/materials/[id]
export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params

  const existing = await db.material.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المادة غير موجودة')
  }
  await db.material.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
