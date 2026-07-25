import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth, withCompanyScope } from '@/lib/permissions'

// GET /api/materials?warehouseId=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/materials
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { name, unit, warehouseId, quantity, unitCost, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المادة مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }
    if (!warehouseId) {
      return NextResponse.json({ error: 'المخزن مطلوب' }, { status: 400 })
    }

    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId },
    })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 400 })
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
