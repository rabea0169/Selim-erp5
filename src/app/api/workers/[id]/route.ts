import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth, jsonError, notFound } from '@/lib/api'

export const PUT = withAuth<{ id: string }>('update', async ({ auth, params, req }) => {
  const { id } = params
  const body = await req.json()
  const { name, phone, job, type, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم الموظف مطلوب')
  }

  const existing = await db.worker.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('الموظف غير موجود')
  }

  const validType = type === 'production' ? 'production' : 'monthly'

  const worker = await db.worker.update({
    where: { id },
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      job: job?.trim() || null,
      type: validType,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json({ worker })
})

export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params

  const existing = await db.worker.findFirst({ where: { id, companyId: auth.companyId } })
  if (!existing) {
    return notFound('الموظف غير موجود')
  }

  await db.worker.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
