import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/products?q=&page=&limit=&category=&warehouseId=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const page = Number(searchParams.get('page')) || 1
    const limit = Number(searchParams.get('limit')) || 25
    const category = searchParams.get('category') || ''
    const warehouseId = searchParams.get('warehouseId') || ''

    const where: any = withCompanyScope({}, auth.companyId)
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { notes: { contains: q } },
      ]
    }
    if (category) {
      where.category = category
    }
    if (warehouseId) {
      where.warehouseId = warehouseId
    }

    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { warehouse: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ])

    return NextResponse.json({ products, total, page, limit })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// POST /api/products
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

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

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    if (warehouseId) {
      const warehouse = await db.warehouse.findFirst({
        where: { id: warehouseId, companyId: auth.companyId },
      })
      if (!warehouse) {
        return NextResponse.json({ error: 'المستودع المحدد غير موجود' }, { status: 400 })
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
        reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : null,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
      include: { warehouse: true },
    })

    return NextResponse.json({ product })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
