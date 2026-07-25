import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

// GET /api/production-orders?status=&from=&to=&q=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q')

    const where: any = withCompanyScope({}, auth.companyId)
    if (status) where.status = status
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { productName: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const orders = await db.productionOrder.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json({ orders })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/production-orders
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const {
      orderNumber, productId, productName, quantity, unit, status,
      materials, stages, date, expectedEndDate, notes,
    } = body

    if (!productId?.trim()) {
      return NextResponse.json({ error: 'المنتج مطلوب' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً موجباً' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }

    const product = await db.product.findFirst({ where: { id: productId, companyId: auth.companyId } })
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }

    const order = await db.productionOrder.create({
      data: {
        orderNumber: orderNumber?.trim() || `PO-${Date.now()}`,
        productId,
        productName: productName?.trim() || product.name,
        quantity: qty,
        unit: unit?.trim() || product.unit || 'قطعة',
        status: status?.trim() || 'draft',
        materials: materials ?? [],
        stages: stages ?? [],
        date: new Date(date),
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
    })

    return NextResponse.json({ order })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
