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
        { job: { contains: q } },
      ]
    }

    const workers = await db.worker.findMany({
      where,
      include: {
        advances: { orderBy: { date: 'desc' } },
        receipts: { orderBy: { date: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate totals
    const workersWithTotals = workers.map((w) => {
      const totalAdvances = w.advances.reduce((s, a) => s + a.amount, 0)
      const totalReceipts = w.receipts.reduce((s, r) => s + r.amount, 0)
      return { ...w, totalAdvances, totalReceipts, balance: totalAdvances - totalReceipts }
    })

    return NextResponse.json({ workers: workersWithTotals })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone, job, notes } = body
    const worker = await db.worker.create({
      data: { name, phone: phone || null, job: job || null, notes: notes || null },
    })
    return NextResponse.json({ worker })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
