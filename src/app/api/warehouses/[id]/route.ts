import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/permissions'

// GET /api/warehouses/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const warehouse = await db.warehouse.findFirst({
      where: { id, companyId: auth.companyId },
      include: { materials: true, products: true },
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
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const body = await req.json()
    const existing = await db.warehouse.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        type: body.type?.trim() ?? existing.type,
        location: body.location?.trim() ?? existing.location,
        notes: body.notes?.trim() ?? existing.notes,
      },
    })
    return NextResponse.json({ warehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/warehouses/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response
    const { id } = await params

    const existing = await db.warehouse.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }
    await db.warehouse.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
