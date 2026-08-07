import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { name, phone, address, notes, creditLimit, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }

    // فحص وجود المورد وتبعيته للشركة (حماية IDOR) — الفلتر إجباري
    const existing = await db.supplier.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        creditLimit: Number(creditLimit) > 0 ? Number(creditLimit) : null,
        openingBalance: Number(openingBalance) > 0 ? Number(openingBalance) : 0,
      },
    })
    return NextResponse.json({ supplier })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params

    // فحص وجود المورد وتبعيته للشركة (حماية IDOR)
    const existing = await db.supplier.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'المورد غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // فصل المشتريات المرتبطة بهذا المورد — داخل نفس الشركة فقط
      await tx.purchase.updateMany({
        where: { supplierId_ref: id, companyId },
        data: { supplierId_ref: null },
      })
      await tx.supplier.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
