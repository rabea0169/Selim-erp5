import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, jsonError, notFound } from '@/lib/api'

export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params
  const body = await req.json()
  const { name, phone, address, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم العميل مطلوب')
  }

  const existing = await db.customer.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('العميل غير موجود')
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
})

export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params

  const existing = await db.customer.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('العميل غير موجود')
  }

  await db.sale.updateMany({
    where: { customerId_ref: id },
    data: { customerId_ref: null },
  })
  await db.customer.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
