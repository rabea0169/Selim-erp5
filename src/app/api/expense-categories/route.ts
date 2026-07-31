import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET() {
  try {
    const cats = await db.expenseCategory.findMany({
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
    const body = await req.json()
    const { name, notes } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الفئة مطلوب' }, { status: 400 })
    }
    const cat = await db.expenseCategory.create({
      data: { name: name.trim(), notes: notes || null },
    })
    return NextResponse.json({ category: cat })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
