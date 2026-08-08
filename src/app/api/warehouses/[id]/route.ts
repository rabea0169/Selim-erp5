import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'

const VALID_WAREHOUSE_TYPES = ['raw_materials', 'finished_goods', 'general']

// GET /api/warehouses/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params
    const warehouse = await db.warehouse.findFirst({
      where: { id, companyId },
      include: { _count: { select: { materials: true, products: true } } },
    })
    if (!warehouse) {
      return NextResponse.json({ error: 'المخزن غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ warehouse })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// PUT /api/warehouses/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { name, type, location, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })
    }
    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع المخزن مطلوب' }, { status: 400 })
    }
    if (!VALID_WAREHOUSE_TYPES.includes(type.trim())) {
      return NextResponse.json({ error: 'نوع المستودع غير صالح' }, { status: 400 })
    }

    // فحص وجود المخزن وتبعيته للشركة (حماية IDOR) — الفلتر إجباري
    const existing = await db.warehouse.findFirst({
      where: { id, companyId },
    })
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
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// DELETE /api/warehouses/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params
    // فحص وجود المخزن وتبعيته للشركة (حماية IDOR)
    const existing = await db.warehouse.findFirst({
      where: { id, companyId },
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
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
