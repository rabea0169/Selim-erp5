import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/production-orders/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const order = await db.productionOrder.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ productionOrder: order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/production-orders/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { orderNumber, productId, productName, quantity, completedQuantity, unit, status, materials, stages, date, expectedEndDate, completedDate, notes } = body

    const existing = await db.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    if (productId && productId !== existing.productId) {
      const product = await db.product.findUnique({ where: { id: productId } })
      if (!product) {
        return NextResponse.json({ error: 'المنتج المحدد غير موجود' }, { status: 404 })
      }
    }

    const order = await db.productionOrder.update({
      where: { id },
      data: {
        orderNumber: orderNumber?.trim() || existing.orderNumber,
        productId: productId || existing.productId,
        productName: productName?.trim() || existing.productName,
        quantity: quantity != null ? Number(quantity) : existing.quantity,
        completedQuantity: completedQuantity != null ? Number(completedQuantity) : existing.completedQuantity,
        unit: unit?.trim() || existing.unit,
        status: status || existing.status,
        materials: materials !== undefined ? materials : existing.materials,
        stages: stages !== undefined ? stages : existing.stages,
        date: date ? new Date(date) : existing.date,
        expectedEndDate: expectedEndDate !== undefined ? (expectedEndDate ? new Date(expectedEndDate) : null) : existing.expectedEndDate,
        completedDate: completedDate !== undefined ? (completedDate ? new Date(completedDate) : null) : existing.completedDate,
        notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
      },
    })
    return NextResponse.json({ productionOrder: order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/production-orders/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.productionOrder.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }
    await db.productionOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
