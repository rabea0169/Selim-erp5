import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { handleApiError } from '@/lib/api-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    await db.sale.delete({ where: { id, companyId: auth.companyId } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e, 'DELETE /api/sales/[id]')
  }
}
