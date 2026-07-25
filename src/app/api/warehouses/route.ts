import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth, jsonError } from '@/lib/api'

// GET /api/warehouses
export const GET = withAuth('read', async ({ auth }) => {
  const warehouses = await db.warehouse.findMany({
    where: withCompanyScope({}, auth.companyId),
    include: {
      _count: { select: { materials: true, products: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ warehouses })
})

// POST /api/warehouses
export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { name, type, location, notes } = body

  if (!name?.trim()) {
    return jsonError('اسم المخزن مطلوب')
  }
  if (!type?.trim()) {
    return jsonError('نوع المخزن مطلوب')
  }

  const warehouse = await db.warehouse.create({
    data: {
      name: name.trim(),
      type: type.trim(),
      location: location?.trim() || null,
      notes: notes?.trim() || null,
      companyId: auth.companyId,
    },
  })

  return NextResponse.json({ warehouse })
})
