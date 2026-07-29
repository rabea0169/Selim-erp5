import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

function numOrNull(value: unknown): number | null {
  const n = Number(value)
  return value === null || value === undefined || value === '' || isNaN(n) ? null : n
}

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
        { job: { contains: q, mode: 'insensitive' } },
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
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { name, phone, job, type, notes, hourlyRate, overtimeRate, workStartTime, workHoursPerDay, monthlySalary } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الموظف مطلوب' }, { status: 400 })
    }

    const validType = type === 'production' || type === 'hourly' ? type : 'monthly'

    const worker = await db.worker.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        job: job?.trim() || null,
        type: validType,
        notes: notes?.trim() || null,
        hourlyRate: numOrNull(hourlyRate),
        overtimeRate: numOrNull(overtimeRate),
        workStartTime: workStartTime?.trim() || null,
        workHoursPerDay: numOrNull(workHoursPerDay),
        monthlySalary: numOrNull(monthlySalary),
        companyId: auth.companyId,
      },
    })
    return NextResponse.json({ worker })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
