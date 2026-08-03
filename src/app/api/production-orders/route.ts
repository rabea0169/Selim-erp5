import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const validStatuses = ['draft', 'in_progress', 'completed', 'cancelled']
    const where: any = {}
    if (status && validStatuses.includes(status)) where.status = status
    if (q) where.orderNumber = { contains: q }

    const [orders, total] = await Promise.all([
      db.productionOrder.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.productionOrder.count({ where }),
    ])

    return NextResponse.json({
      orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, productName, quantity, unit, materials, stages, date, expectedEndDate, notes } = body

    if (!productId || !productName?.trim()) {
      return NextResponse.json({ error: 'المنتج مطلوب' }, { status: 400 })
    }
    if (!quantity || Number(quantity) <= 0) {
      return NextResponse.json({ error: 'الكمية مطلوبة' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'التاريخ غير صالح' }, { status: 400 })
    }

    const parsedMaterials = (materials || []) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }>
    const hasMaterials = parsedMaterials.length > 0 && parsedMaterials.every((m) => m.materialId)
    const orderStatus = hasMaterials ? 'in_progress' : 'draft'

    // Fix L: Retry loop for order number collision
    let orderNumber: string
    let attempts = 0
    let order: any
    while (attempts < 3) {
      const count = await db.productionOrder.count()
      orderNumber = `PO-${String(count + 1).padStart(5, '0')}`
      try {
        order = await db.$transaction(async (tx) => {
          const product = await tx.product.findUnique({ where: { id: productId } })
          if (!product) {
            throw new Error('المنتج غير موجود')
          }

          const newOrder = await tx.productionOrder.create({
            data: {
              orderNumber,
              productId,
              productName: productName.trim(),
              quantity: Number(quantity),
              unit: unit || product.unit,
              status: orderStatus,
              materials: materials || [],
              stages: stages || [],
              date: dateObj,
              expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
              notes: notes?.trim() || null,
            },
          })

          if (hasMaterials) {
            for (const mat of parsedMaterials) {
              if (!mat.materialId) continue

              const material = await tx.material.findUnique({ where: { id: mat.materialId } })
              if (!material) {
                throw new Error(`المادة ${mat.materialName} غير موجودة`)
              }
              if (material.quantity < mat.quantity) {
                throw new Error(`الكمية المتاحة من ${mat.materialName} (${material.quantity}) أقل من المطلوب (${mat.quantity})`)
              }

              await tx.material.update({
                where: { id: mat.materialId },
                data: { quantity: { decrement: mat.quantity }, updatedAt: new Date() },
              })

              await tx.materialTransaction.create({
                data: {
                  materialId: mat.materialId,
                  warehouseId: material.warehouseId,
                  type: 'out',
                  quantity: mat.quantity,
                  unitCost: material.unitCost,
                  date: dateObj,
                  reason: `أمر تشغيل ${orderNumber}`,
                  referenceType: 'production_order',
                  referenceId: newOrder.id,
                  notes: `سحب لإنتاج ${productName.trim()}`,
                },
              })
            }
          }

          return newOrder
        })
        break
      } catch (e: any) {
        if (e.code === 'P2002' && attempts < 2) { attempts++; continue }
        throw e
      }
    }

    return NextResponse.json({ order })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود') || e.message.includes('أقل من المطلوب'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
