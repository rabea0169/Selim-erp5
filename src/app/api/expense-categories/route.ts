import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'
import { handleApiError } from '@/lib/api-error'

export async function GET() {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const cats = await db.expenseCategory.findMany({
      where: withCompanyScope({}, auth.companyId),
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    })
    return NextResponse.json({ categories: cats })
  } catch (e) {
    return handleApiError(e, 'GET /api/expense-categories')
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { name, notes } = body
    const cat = await db.expenseCategory.create({
      data: { name, notes: notes || null, companyId: auth.companyId },
    })
    return NextResponse.json({ category: cat })
  } catch (e) {
    return handleApiError(e, 'POST /api/expense-categories')
  }
}
