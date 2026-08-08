import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { id } = await params
    const companyId = scope.companyId
    const existing = await db.expenseCategory.findFirst({
      where: { id, companyId },
      include: { _count: { select: { expenses: true } } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'الفئة غير موجودة' }, { status: 404 })
    }

    // يُمنع حذف بند له مصروفات مرتبطة (حفاظاً على سلامة البيانات المحاسبية)
    if (existing._count.expenses > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف هذا البند — مرتبط بـ ${existing._count.expenses} مصروف. احذف المصروفات أولاً.` },
        { status: 400 }
      )
    }

    await db.expenseCategory.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
