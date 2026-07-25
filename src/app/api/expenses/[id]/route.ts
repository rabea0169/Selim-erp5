import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth } from '@/lib/api'

export const DELETE = withAuth<{ id: string }>('delete', async ({ auth, params }) => {
  const { id } = params
  await db.expense.delete({ where: { id, companyId: auth.companyId } })
  return NextResponse.json({ success: true })
})
