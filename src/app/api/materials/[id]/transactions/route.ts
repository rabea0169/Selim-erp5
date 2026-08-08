import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/materials/[id]/transactions — حركات مادة محددة (مصفوفة مباشرة كما يتوقع العميل)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params

    // التحقق من ملكية المادة للشركة (منع IDOR)
    const material = await db.material.findFirst({ where: { id, companyId } })
    if (!material) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
    }

    const transactions = await db.materialTransaction.findMany({
      where: { materialId: id, companyId },
      orderBy: { date: 'desc' },
      take: 200,
    })

    return NextResponse.json(transactions)
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
