import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/materials?q=&warehouseId=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const warehouseId = searchParams.get('warehouseId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = { companyId }
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
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/materials
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

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

    if (Number(body.quantity) < 0) {
      return NextResponse.json({ error: 'الكمية لا يمكن أن تكون سالبة' }, { status: 400 })
    }
    if (Number(body.unitCost) < 0) {
      return NextResponse.json({ error: 'سعر الوحدة لا يمكن أن يكون سالباً' }, { status: 400 })
    }

    // المخزن يجب أن ينتمي لنفس الشركة
    const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, companyId } })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
    }

    const material = await db.material.create({
      data: {
        companyId,
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
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
