import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError, getPagination } from '@/lib/api'

// GET /api/products?q=&page=&limit=&category=&warehouseId=
export const GET = withAuth('read', async ({ auth, req }) => {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const warehouseId = searchParams.get('warehouseId') || ''
  const { page, limit, skip } = getPagination(searchParams)

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
})

// POST /api/products
export const POST = withAuth('create', async ({ auth, req }) => {
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
    return jsonError('اسم المنتج مطلوب')
  }
  if (!unit?.trim()) {
    return jsonError('الوحدة مطلوبة')
  }

  if (warehouseId) {
    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId },
    })
    if (!warehouse) {
      return jsonError('المستودع المحدد غير موجود')
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
})
