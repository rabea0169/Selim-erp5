import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/production-orders?status=&q=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = {}
    if (status) where.status = status
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/production-orders
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

    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }

    const count = await db.productionOrder.count()
    const orderNumber = `PO-${String(count + 1).padStart(5, '0')}`

    // ===== ربط دورة الإنتاج بالمخزون =====
    // إذا تم تمرير مواد خام مع أمر التشغيل، يتم سحبها من المخزن مباشرة
    const parsedMaterials = (materials || []) as Array<{ materialId: string; materialName: string; quantity: number; unit: string }>
    const hasMaterials = parsedMaterials.length > 0 && parsedMaterials.every((m) => m.materialId)
    const orderStatus = hasMaterials ? 'in_progress' : 'draft'

    const order = await db.$transaction(async (tx) => {
      // إنشاء أمر التشغيل أولاً للحصول على المعرف
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
          date: new Date(date),
          expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
          notes: notes?.trim() || null,
        },
      })

      // سحب المواد الخام من المخزن عند الإنشاء المباشر (in_progress)
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

          // سحب الكمية من المادة الخام
          await tx.material.update({
            where: { id: mat.materialId },
            data: { quantity: { decrement: mat.quantity }, updatedAt: new Date() },
          })

          // تسجيل حركة السحب
          await tx.materialTransaction.create({
            data: {
              materialId: mat.materialId,
              warehouseId: material.warehouseId,
              type: 'out',
              quantity: mat.quantity,
              unitCost: material.unitCost,
              date: new Date(date),
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

    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
