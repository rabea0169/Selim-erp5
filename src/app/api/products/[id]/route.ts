import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, jsonError, notFound } from '@/lib/api'

// GET /api/products/[id]
export const GET = withAuth<{ id: string }>('read', async ({ auth, params }) => {
  const { id } = params

  const product = await db.product.findFirst({
    where: { id, companyId: auth.companyId },
    include: { warehouse: true },
  })

  if (!product) {
    return notFound('المنتج غير موجود')
  }

  return NextResponse.json({ product })
})

// PUT /api/products/[id]
export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params
  const body = await req.json()
  const {
    name,
    category,
    unit,
    wholesalePrice,
    halfWholesalePrice,
    retailPrice,
    cost,
    warehouseId,
    quantity,
    reorderLevel,
    notes,
  } = body

  const existing = await db.product.findFirst({
    where: { id, companyId: auth.companyId },
  })
  if (!existing) {
    return notFound('المنتج غير موجود')
  }

  if (warehouseId) {
    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId },
    })
    if (!warehouse) {
      return jsonError('المستودع المحدد غير موجود')
    }
  }

  const product = await db.product.update({
    where: { id },
    data: {
      name: name?.trim() || existing.name,
      category: category !== undefined ? (category?.trim() || null) : existing.category,
      unit: unit?.trim() || existing.unit,
      wholesalePrice: Number(wholesalePrice) || 0,
      halfWholesalePrice: Number(halfWholesalePrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      cost: Number(cost) || 0,
      warehouseId: warehouseId !== undefined ? (warehouseId || null) : existing.warehouseId,
      quantity: Number(quantity) || 0,
      reorderLevel: reorderLevel !== undefined ? (Number(reorderLevel) || null) : existing.reorderLevel,
      notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
    },
    include: { warehouse: true },
  })

  return NextResponse.json({ product })
})

// DELETE /api/products/[id]
export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params
  await db.product.delete({ where: { id, companyId: auth.companyId } })
  return NextResponse.json({ success: true })
})
