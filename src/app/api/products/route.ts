import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/products?q=&warehouseId=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const warehouseId = searchParams.get('warehouseId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user?.companyId ? { companyId: user.companyId } : {}
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
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, category, unit, halfWholesalePrice, warehouseId, quantity, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    const retailPrice = Number(body.retailPrice) || 0
    const wholesalePrice = Number(body.wholesalePrice) || 0
    const costPrice = Number(body.cost) || 0
    if (retailPrice < 0 || wholesalePrice < 0 || costPrice < 0) {
      return NextResponse.json({ error: 'الأسعار لا يمكن أن تكون سالبة' }, { status: 400 })
    }
    const qty = Number(body.quantity) || 0
    if (qty < 0) {
      return NextResponse.json({ error: 'الكمية لا يمكن أن تكون سالبة' }, { status: 400 })
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findFirst({
        where: { id: warehouseId, ...(user?.companyId ? { companyId: user.companyId } : {}) },
      })
      if (!warehouse) {
        return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
      }
    }

    const product = await db.product.create({
      data: {
        companyId: user?.companyId || null,
        name: name.trim(),
        category: category?.trim() || null,
        unit: unit.trim(),
        wholesalePrice,
        halfWholesalePrice: Number(halfWholesalePrice) || 0,
        retailPrice,
        cost: costPrice,
        warehouseId: warehouseId || null,
        quantity: qty,
        reorderLevel: reorderLevel != null ? Number(reorderLevel) : null,
        notes: notes?.trim() || null,
      },
      include: { warehouse: true },
    })

    return NextResponse.json({ product })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
