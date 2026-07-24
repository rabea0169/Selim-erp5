import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

export async function GET() {
  try {
    const cats = await db.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    })
    return NextResponse.json({ categories: cats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, notes } = body
    const cat = await db.expenseCategory.create({
      data: { name, notes: notes || null },
    })
    return NextResponse.json({ category: cat })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
