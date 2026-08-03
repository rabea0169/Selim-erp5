import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const existing = await db.production.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })
    }

    await db.production.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
