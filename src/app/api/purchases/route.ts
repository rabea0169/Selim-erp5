import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const q = searchParams.get('q') || ''

    const where: any = {}
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    if (q) {
      where.OR = [
        { supplierName: { contains: q } },
        { invoiceNo: { contains: q } },
        { notes: { contains: q } },
      ]
    }

    const purchases = await db.purchase.findMany({
      where,
      include: { items: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ purchases })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { supplierName, supplierId_ref, invoiceNo, date, items, paid, notes } = body

    const total = (items as any[]).reduce(
      (sum, it) => sum + Number(it.quantity) * Number(it.unitPrice),
      0
    )

    const purchase = await db.purchase.create({
      data: {
        supplierName,
        supplierId_ref: supplierId_ref || null,
        invoiceNo: invoiceNo || null,
        date: new Date(date),
        total,
        paid: Number(paid) || 0,
        notes: notes || null,
        items: {
          create: (items as any[]).map((it) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            total: Number(it.quantity) * Number(it.unitPrice),
          })),
        },
      },
      include: { items: true },
    })

    return NextResponse.json({ purchase })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
