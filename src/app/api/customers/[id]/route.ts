import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const body = await req.json()
    const { name, phone, address, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود العميل ومدى تبعيته للشركة للحماية من ثغرة IDOR
    const existing = await db.customer.findFirst({
      where: { id, ...(user?.companyId ? { companyId: user.companyId } : {}) },
    })
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
      },
    })
    return NextResponse.json({ customer })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params

    const existing = await db.customer.findFirst({
      where: { id, ...(user?.companyId ? { companyId: user.companyId } : {}) },
    })
    if (!existing) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 })
    }

    await db.$transaction(async (tx) => {
      // فصل المبيعات المرتبطة بهذا العميل
      await tx.sale.updateMany({
        where: { customerId_ref: id },
        data: { customerId_ref: null },
      })

      await tx.customer.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
