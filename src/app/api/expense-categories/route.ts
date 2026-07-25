import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withCompanyScope } from '@/lib/permissions'
import { withAuth } from '@/lib/api'

export const GET = withAuth('read', async ({ auth }) => {
  const cats = await db.expenseCategory.findMany({
    where: withCompanyScope({}, auth.companyId),
    orderBy: { name: 'asc' },
    include: { _count: { select: { expenses: true } } },
  })
  return NextResponse.json({ categories: cats })
})

export const POST = withAuth('create', async ({ auth, req }) => {
  const body = await req.json()
  const { name, notes } = body
  const cat = await db.expenseCategory.create({
    data: { name, notes: notes || null, companyId: auth.companyId },
  })
  return NextResponse.json({ category: cat })
})
