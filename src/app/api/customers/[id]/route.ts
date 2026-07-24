import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, phone, address, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود العميل
    const existing = await db.customer.findUnique({ where: { id } })
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // التحقق من وجود العميل
    const existing = await db.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      )
    }

    // فصل المبيعات المرتبطة بهذا العميل (SetNull بسبب العلاقة الاختيارية)
    // لكن نحتفظ باسم العميل في customerName للفواتير القديمة
    await db.sale.updateMany({
      where: { customerId_ref: id },
      data: { customerId_ref: null },
    })

    await db.customer.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
