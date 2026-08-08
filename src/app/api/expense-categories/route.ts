import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function GET() {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const cats = await db.expenseCategory.findMany({
      where: { companyId: scope.companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    })
    return NextResponse.json({ categories: cats })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const body = await req.json()
    const { name, notes } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })
    }
    const cat = await db.expenseCategory.create({
      data: { companyId: scope.companyId, name: name.trim(), notes: notes || null },
    })
    return NextResponse.json({ category: cat })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
