import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { requireAdmin } from '@/lib/admin-check'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { name, phone, address, notes, creditLimit, openingBalance } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود العميل داخل نفس الشركة (حماية IDOR)
    const existing = await db.customer.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }

    const customer = await db.customer.update({
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
    return NextResponse.json({ customer })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }
    const companyId = admin.companyId
    const { id } = await params

    // التحقق من وجود العميل داخل نفس الشركة
    const existing = await db.customer.findFirst({ where: { id, companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })
    }

    // Fix F: Wrap in transaction
    await db.$transaction(async (tx: any) => {
      // فصل المبيعات المرتبطة بهذا العميل (SetNull بسبب العلاقة الاختيارية) — داخل الشركة فقط
      await tx.sale.updateMany({
        where: { customerId_ref: id, companyId },
        data: { customerId_ref: null },
      })

      await tx.customer.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
