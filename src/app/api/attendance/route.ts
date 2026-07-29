import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')
    const date = searchParams.get('date')

    // سجلات الموظفين ليس بها companyId، تُفلتر عبر علاقة worker
    const where: any = { worker: { companyId: auth.companyId } }
    if (workerId) where.workerId = workerId

    if (date) {
      const d = new Date(date)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.date = { gte: d, lt: next }
    } else if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const records = await db.workerAttendance.findMany({
      where,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ attendance: records })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { workerId, date, checkIn, checkOut, status, notes } = body

    if (!workerId) {
      return NextResponse.json({ error: 'الموظف مطلوب' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }

    const worker = await db.worker.findFirst({ where: { id: workerId, companyId: auth.companyId } })
    if (!worker) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    const validStatus = ['present', 'absent', 'leave'].includes(status) ? status : 'present'

    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const existing = await db.workerAttendance.findFirst({
      where: { workerId, date: { gte: dayStart, lt: dayEnd } },
    })

    if (existing) {
      const updated = await db.workerAttendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
          checkOut: checkOut ? new Date(checkOut) : existing.checkOut,
          status: validStatus,
          notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
        },
        include: { worker: true },
      })
      return NextResponse.json({ attendance: updated, updated: true })
    }

    const record = await db.workerAttendance.create({
      data: {
        workerId,
        date: new Date(date),
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        status: validStatus,
        notes: notes?.trim() || null,
      },
      include: { worker: true },
    })
    return NextResponse.json({ attendance: record, created: true })
  } catch {
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
