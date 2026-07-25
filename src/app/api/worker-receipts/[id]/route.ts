import { NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { withAuth } from '@/lib/api'

export const DELETE = withAuth<{ id: string }>('delete', async ({ params }) => {
  const { id } = params
  await db.workerReceipt.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
