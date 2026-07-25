import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/permissions'

// GET /api/products/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params

    const product = await db.product.findFirst({
      where: { id, companyId: auth.companyId },
      include: { warehouse: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/products/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response

    const { id } = await params
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
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findFirst({
        where: { id: warehouseId, companyId: auth.companyId },
      })
      if (!warehouse) {
        return NextResponse.json({ error: 'المستودع المحدد غير موجود' }, { status: 400 })
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/products/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    await db.product.delete({ where: { id, companyId: auth.companyId } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
