import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { handleApiError } from '@/lib/api-error'

// GET /api/materials/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const material = await db.material.findFirst({
      where: { id, companyId: auth.companyId },
      include: { warehouse: true },
    })
    if (!material) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
    }
    return NextResponse.json({ material })
  } catch (e) {
    return handleApiError(e, 'GET /api/materials/[id]')
  }
}

// PUT /api/materials/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const body = await req.json()
    const existing = await db.material.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
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
  } catch (e) {
    return handleApiError(e, 'PUT /api/materials/[id]')
  }
}

// DELETE /api/materials/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const existing = await db.material.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
    }
    await db.material.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e, 'DELETE /api/materials/[id]')
  }
}