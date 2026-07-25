import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError } from '@/lib/api'

// GET /api/materials?warehouseId=
export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const warehouseId = searchParams.get('warehouseId')
  const q = searchParams.get('q') || ''

  const where: any = withCompanyScope({}, auth.companyId)
  if (warehouseId) where.warehouseId = warehouseId
  if (q) {
    where.name = { contains: q }
  }

  const materials = await db.material.findMany({
    where,
    include: { warehouse: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ materials })
})

// POST /api/materials
export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { name, unit, warehouseId, quantity, unitCost, reorderLevel, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم المادة مطلوب')
  }
  if (!unit?.trim()) {
    return jsonError('الوحدة مطلوبة')
  }
  if (!warehouseId) {
    return jsonError('المخزن مطلوب')
  }

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId: auth.companyId },
  })
  if (!warehouse) {
    return jsonError('المخزن غير موجود')
  }

  const material = await db.material.create({
    data: {
      name: name.trim(),
      unit: unit.trim(),
      warehouseId,
      quantity: Number(quantity) || 0,
      unitCost: Number(unitCost) || 0,
      reorderLevel: reorderLevel != null ? Number(reorderLevel) : null,
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
  })

  return NextResponse.json({ material })
})
