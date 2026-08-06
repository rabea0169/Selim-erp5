import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''

    const where: any = user?.companyId ? { companyId: user.companyId } : {}
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

    const workersWithTotals = workers.map((w) => {
      const totalAdvances = w.advances.reduce((s, a) => s + a.amount, 0)
      const totalReceipts = w.receipts.reduce((s, r) => s + r.amount, 0)
      return {
        ...w,
        totalAdvances,
        totalReceipts,
        balance: totalAdvances - totalReceipts,
      }
    })

    return NextResponse.json({ workers: workersWithTotals })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()
    const { name, phone, job, type, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم الموظف مطلوب' },
        { status: 400 }
      )
    }

    const VALID_WORKER_TYPES = ['monthly', 'production', 'hourly']
    if (type && !VALID_WORKER_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع العامل غير صالح' }, { status: 400 })
    }
    const validType = type || 'monthly'

    const worker = await db.worker.create({
      data: {
        companyId: user?.companyId || null,
        name: name.trim(),
        phone: phone?.trim() || null,
        job: job?.trim() || null,
        type: validType,
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ worker })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
