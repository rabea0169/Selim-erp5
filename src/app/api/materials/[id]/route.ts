import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'

// GET /api/materials/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const { id } = await params
    const material = await db.material.findFirst({
      where: { id, companyId: user.companyId ?? null },
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
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { name, unit, warehouseId, quantity, unitCost, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الخامة مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    const existing = await db.material.findFirst({ where: { id, companyId } })
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
      const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, companyId } })
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
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params
    const existing = await db.material.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 })
    }
    // منع حذف مادة لها حركات مخزن مسجلة (حفاظاً على سجل الحركات)
    const transactionsCount = await db.materialTransaction.count({
      where: { materialId: id, companyId },
    })
    if (transactionsCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف مادة لها حركات مخزن مسجلة (${transactionsCount} حركة)` },
        { status: 400 }
      )
    }
    await db.material.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
