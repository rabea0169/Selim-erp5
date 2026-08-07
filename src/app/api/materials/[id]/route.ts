import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/materials/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const material = await db.material.findUnique({
      where: { id },
      include: { warehouse: true },
    })
    if (!material) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json({ material })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// PUT /api/materials/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, unit, warehouseId, quantity, unitCost, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الخامة مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    const existing = await db.material.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 })
    }

    if (Number(body.quantity) < 0) {
      return NextResponse.json({ error: 'الكمية لا يمكن أن تكون سالبة' }, { status: 400 })
    }
    if (Number(body.unitCost) < 0) {
      return NextResponse.json({ error: 'سعر الوحدة لا يمكن أن يكون سالباً' }, { status: 400 })
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse) {
        return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
      }
    }

    const material = await db.material.update({
      where: { id },
      data: {
        name: name.trim(),
        unit: unit.trim(),
        warehouseId: warehouseId || existing.warehouseId,
        quantity: Number(quantity) || 0,
        unitCost: Number(unitCost) || 0,
        reorderLevel: reorderLevel != null ? Number(reorderLevel) : null,
        notes: notes?.trim() || null,
      },
      include: { warehouse: true },
    })

    return NextResponse.json({ material })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/materials/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.material.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 })
    }
    await db.material.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
