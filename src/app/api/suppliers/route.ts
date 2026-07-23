import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const where: any = {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
      ]
    }
    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: { select: { purchases: true } },
        purchases: {
          select: { total: true, paid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const withTotals = suppliers.map((s) => {
      const totalPurchases = s.purchases.reduce((sum, x) => sum + x.total, 0)
      const totalPaid = s.purchases.reduce((sum, x) => sum + x.paid, 0)
      return {
        ...s,
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
        purchasesCount: s._count.purchases,
        purchases: undefined,
        _count: undefined,
      }
    })
    return NextResponse.json({ suppliers: withTotals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, notes } = body
    if (!name?.trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    }
    const supplier = await db.supplier.create({
      data: { name, phone: phone || null, address: address || null, notes: notes || null },
    })
    return NextResponse.json({ supplier })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
