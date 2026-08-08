import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/material-transactions — قائمة حركات المواد للشركة الحالية (مصفوفة مباشرة كما يتوقع العميل)
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const materialId = searchParams.get('materialId')
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 200))

    const where: any = { companyId }
    if (materialId) where.materialId = materialId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const transactions = await db.materialTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit,
    })

    // مصفوفة مباشرة — العميل (MaterialRepository.getAllTransactions) يتوقع array
    return NextResponse.json(transactions)
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
