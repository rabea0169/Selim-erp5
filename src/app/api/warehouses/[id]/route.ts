import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/warehouses/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const warehouse = await db.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { materials: true, products: true } } },
    })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ warehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PUT /api/warehouses/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, type, location, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })
    }
    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع المخزن مطلوب' }, { status: 400 })
    }

    const existing = await db.warehouse.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        name: name.trim(),
        type: type.trim(),
        location: location?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { _count: { select: { materials: true, products: true } } },
    })

    return NextResponse.json({ warehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/warehouses/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.warehouse.findUnique({
      where: { id },
      include: { _count: { select: { materials: true, products: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }
    if (existing._count.materials > 0 || existing._count.products > 0) {
      return NextResponse.json({ error: 'لا يمكن حذف مخزن يحتوي على مواد أو منتجات' }, { status: 400 })
    }
    await db.warehouse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
