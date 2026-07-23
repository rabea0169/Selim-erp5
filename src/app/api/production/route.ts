import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')

    const where: any = {}
    if (workerId) where.workerId = workerId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const productions = await db.production.findMany({
      where,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ productions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workerId, date, modelName, quantity, unitPrice, notes } = body
    if (!workerId || !modelName?.trim() || !quantity || !unitPrice) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    const qty = Number(quantity)
    const price = Number(unitPrice)
    const production = await db.production.create({
      data: {
        workerId,
        date: new Date(date),
        modelName,
        quantity: qty,
        unitPrice: price,
        total: qty * price,
        notes: notes || null,
      },
      include: { worker: true },
    })
    return NextResponse.json({ production })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
