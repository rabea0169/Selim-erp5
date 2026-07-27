import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/products?q=&warehouseId=&page=1&limit=50
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

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { warehouse: true },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({
      products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, unit, wholesalePrice, halfWholesalePrice, retailPrice, cost, warehouseId, quantity, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse) {
        return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
      }
    }

    const product = await db.product.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        unit: unit.trim(),
        wholesalePrice: Number(wholesalePrice) || 0,
        halfWholesalePrice: Number(halfWholesalePrice) || 0,
        retailPrice: Number(retailPrice) || 0,
        cost: Number(cost) || 0,
        warehouseId: warehouseId || null,
        quantity: Number(quantity) || 0,
        reorderLevel: reorderLevel != null ? Number(reorderLevel) : null,
        notes: notes?.trim() || null,
      },
      include: { warehouse: true },
    })

    return NextResponse.json({ product })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
