import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const { count } = await db.workerAttendance.deleteMany({
      where: { id, worker: { companyId: auth.companyId } },
    })
    if (count === 0) {
      return NextResponse.json({ error: 'سجل الحضور غير موجود' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
