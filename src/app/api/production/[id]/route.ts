import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const production = await db.production.findUnique({ where: { id } })
    if (!production) {
      return NextResponse.json({ error: 'سجل الإنتاج غير موجود' }, { status: 404 })
    }

    // لا حاجة لعمل transaction معقد هنا لان الإنتاج لا يؤثر على المخزون مباشرة
    // (التأثير يكون عبر أوامر التشغيل فقط)
    await db.production.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
