import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/materials?q=&warehouseId=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const warehouseId = searchParams.get('warehouseId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (q) where.name = { contains: q }

    const [materials, total] = await Promise.all([
      db.material.findMany({
        where,
        include: { warehouse: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.material.count({ where }),
    ])

    return NextResponse.json({
      materials,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/materials
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, unit, warehouseId, quantity, unitCost, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الخامة مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }
    if (!warehouseId) {
      return NextResponse.json({ error: 'المخزن مطلوب' }, { status: 400 })
    }

    const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
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
      },
      include: { warehouse: true },
    })

    return NextResponse.json({ material })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
