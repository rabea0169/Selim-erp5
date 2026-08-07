import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params

    // فحص وجود الحركة وتبعيتها للشركة (حماية IDOR)
    const tx = await db.treasuryTransaction.findFirst({
      where: { id, companyId },
    })
    if (!tx) {
      return NextResponse.json({ error: 'المعاملة غير موجودة' }, { status: 404 })
    }

    // حركة مرتبطة بمصروف تُحذف فقط عبر حذف المصروف نفسه (حفاظاً على الترابط المحاسبي)
    if (tx.referenceType === 'expense' && tx.referenceId) {
      return NextResponse.json(
        { error: 'هذه الحركة مرتبطة بمصروف — احذف المصروف من شاشة المصاريف' },
        { status: 400 }
      )
    }

    await db.treasuryTransaction.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e, 500)
    return NextResponse.json({ error }, { status })
  }
}
