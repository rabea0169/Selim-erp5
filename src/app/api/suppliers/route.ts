import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const where: any = withCompanyScope({}, auth.companyId)
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ]
    }
    const suppliers = await db.supplier.findMany({
      where,
      include: {
        _count: { select: { purchases: true } },
        purchases: { select: { total: true, paid: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const withTotals = suppliers.map((s) => {
      const totalPurchases = s.purchases.reduce((sum, x) => sum + x.total, 0)
      const totalPaid = s.purchases.reduce((sum, x) => sum + x.paid, 0)
      return {
        id: s.id, name: s.name, phone: s.phone, address: s.address,
        notes: s.notes, createdAt: s.createdAt,
        totalPurchases, totalPaid, totalRemaining: totalPurchases - totalPaid,
        purchasesCount: s._count.purchases,
      }
    })
    return NextResponse.json({ suppliers: withTotals })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { name, phone, address, notes } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم المورد مطلوب' }, { status: 400 })
    }

    const supplier = await db.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
    })
    return NextResponse.json({ supplier })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
