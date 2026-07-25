import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, jsonError, notFound } from '@/lib/api'

export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params
  const body = await req.json()
  const { name, phone, address, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم المورد مطلوب')
  }

  const existing = await db.supplier.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المورد غير موجود')
  }

  const supplier = await db.supplier.update({
    where: { id },
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json({ supplier })
})

export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params

  const existing = await db.supplier.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('المورد غير موجود')
  }

  await db.purchase.updateMany({
    where: { supplierId_ref: id },
    data: { supplierId_ref: null },
  })
  await db.supplier.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
