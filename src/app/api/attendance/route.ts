import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')
    const date = searchParams.get('date')

    const where: any = {}
    if (workerId) where.workerId = workerId

    if (date) {
      // فلترة بيوم محدد
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
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workerId, date, checkIn, checkOut, status, notes } = body

    // التحقق من البيانات
    if (!workerId) {
      return NextResponse.json(
        { error: 'الموظف مطلوب' },
        { status: 400 }
      )
    }
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود الموظف
    const worker = await db.worker.findUnique({ where: { id: workerId } })
    if (!worker) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من الحالة
    const validStatus = ['present', 'absent', 'leave'].includes(status)
      ? status
      : 'present'

    // تحديد بداية ونهاية اليوم المحدد
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    // البحث عن سجل موجود لنفس الموظف في نفس اليوم
    const existing = await db.workerAttendance.findFirst({
      where: {
        workerId,
        date: { gte: dayStart, lt: dayEnd },
      },
    })

    if (existing) {
      // تحديث السجل الموجود
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

    // إنشاء سجل جديد
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
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
