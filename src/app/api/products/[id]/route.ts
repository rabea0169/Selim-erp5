import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'

// GET /api/products/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = scope.companyId
    const { id } = await params
    const product = await db.product.findFirst({
      where: { id, companyId },
      include: { warehouse: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ product })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// PUT /api/products/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = scope.companyId
    const { id } = await params
    const body = await req.json()
    const { name, category, unit, halfWholesalePrice, warehouseId, reorderLevel, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المنتج مطلوب' }, { status: 400 })
    }
    if (!unit?.trim()) {
      return NextResponse.json({ error: 'الوحدة مطلوبة' }, { status: 400 })
    }

    // فحص وجود المنتج وتبعيته للشركة (حماية IDOR) — الفلتر إجباري
    const existing = await db.product.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
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
        where: { id: warehouseId, companyId },
      })
      if (!warehouse) {
        return NextResponse.json({ error: 'المخزن المحدد غير موجود' }, { status: 404 })
      }
    }

    const product = await db.product.update({
      where: { id },
      data: {
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

// DELETE /api/products/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params

    // فحص وجود المنتج وتبعيته للشركة (حماية IDOR)
    const existing = await db.product.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }

    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
