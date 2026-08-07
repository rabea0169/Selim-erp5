import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/warehouses
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const warehouses = await db.warehouse.findMany({
      where: { companyId },
      include: { _count: { select: { materials: true, products: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ warehouses })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// POST /api/warehouses
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const body = await req.json()
    const { name, type, location, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المخزن مطلوب' }, { status: 400 })
    }
    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع المخزن مطلوب' }, { status: 400 })
    }

    // Fix R: Validate warehouse type
    const VALID_WAREHOUSE_TYPES = ['raw_materials', 'finished_goods', 'general']
    if (!VALID_WAREHOUSE_TYPES.includes(type.trim())) {
      return NextResponse.json({ error: 'نوع المستودع غير صالح' }, { status: 400 })
    }

    const warehouse = await db.warehouse.create({
      data: {
        companyId: user.companyId ?? null,
        name: name.trim(),
        type: type.trim(),
        location: location?.trim() || null,
        notes: notes?.trim() || null,
      },
      include: { _count: { select: { materials: true, products: true } } },
    })

    return NextResponse.json({ warehouse })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
