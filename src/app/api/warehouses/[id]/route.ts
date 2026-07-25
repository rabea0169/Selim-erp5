import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, notFound } from '@/lib/api'

// GET /api/warehouses/[id]
export const GET = withAuth<{ id: string }>('read', async ({ auth, params }) => {
  const { id } = params

  const warehouse = await db.warehouse.findFirst({
    where: { id, companyId: auth.companyId },
    include: { materials: true, products: true },
  })
  if (!warehouse) {
    return notFound('المخزن غير موجود')
  }
  return NextResponse.json({ warehouse })
})

// PUT /api/warehouses/[id]
export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params

  const body = await req.json()
  const existing = await db.warehouse.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المخزن غير موجود')
  }

  const warehouse = await db.warehouse.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? existing.name,
      type: body.type?.trim() ?? existing.type,
      location: body.location?.trim() ?? existing.location,
      notes: body.notes?.trim() ?? existing.notes,
    },
  })
  return NextResponse.json({ warehouse })
})

// DELETE /api/warehouses/[id]
export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params

  const existing = await db.warehouse.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المخزن غير موجود')
  }
  await db.warehouse.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
