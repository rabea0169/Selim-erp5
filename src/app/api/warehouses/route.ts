import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

// GET /api/warehouses
export async function GET() {
  try {
    const warehouses = await db.warehouse.findMany({
      include: { _count: { select: { materials: true, products: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ warehouses })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/warehouses
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, location, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })
    }
    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع المخزن مطلوب' }, { status: 400 })
    }

    const warehouse = await db.warehouse.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        location: location?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { _count: { select: { materials: true, products: true } } },
    })

    return NextResponse.json({ warehouse })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
