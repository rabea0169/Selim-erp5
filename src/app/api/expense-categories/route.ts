import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET() {
  try {
    const user = await getCurrentUser()
    const cats = await db.expenseCategory.findMany({
      where: user?.companyId ? { companyId: user.companyId } : {},
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
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, notes } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })
    }
    const cat = await db.expenseCategory.create({
      data: {
        companyId: user?.companyId || null,
        name: name.trim(),
        notes: notes || null,
      },
    })
    return NextResponse.json({ category: cat })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
