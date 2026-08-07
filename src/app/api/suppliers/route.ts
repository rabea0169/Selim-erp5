import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

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
        id: s.id,
        name: s.name,
        phone: s.phone,
        address: s.address,
        notes: s.notes,
        createdAt: s.createdAt,
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
        purchasesCount: s._count.purchases,
      }
    })
    return NextResponse.json({ suppliers: withTotals })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, address, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم المورد مطلوب' },
        { status: 400 }
      )
    }

    const supplier = await db.supplier.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ supplier })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
