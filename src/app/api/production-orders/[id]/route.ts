import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const order = await db.productionOrder.findFirst({ where: { id, companyId: auth.companyId } })
    if (!order) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existing = await db.productionOrder.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    const body = await req.json()
    const {
      orderNumber, productName, quantity, completedQuantity, unit, status,
      materials, stages, date, expectedEndDate, completedDate, notes,
    } = body

    const data: any = {}
    if (orderNumber !== undefined) data.orderNumber = orderNumber?.trim() || existing.orderNumber
    if (productName !== undefined) data.productName = productName?.trim() || existing.productName
    if (quantity !== undefined) data.quantity = Number(quantity)
    if (completedQuantity !== undefined) data.completedQuantity = Number(completedQuantity)
    if (unit !== undefined) data.unit = unit?.trim() || existing.unit
    if (status !== undefined) data.status = status?.trim() || existing.status
    if (materials !== undefined) data.materials = materials
    if (stages !== undefined) data.stages = stages
    if (date !== undefined) data.date = new Date(date)
    if (expectedEndDate !== undefined) data.expectedEndDate = expectedEndDate ? new Date(expectedEndDate) : null
    if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null
    if (notes !== undefined) data.notes = notes?.trim() || null

    const order = await db.productionOrder.update({ where: { id }, data })
    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const existing = await db.productionOrder.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'أمر التشغيل غير موجود' }, { status: 404 })
    }

    await db.productionOrder.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
