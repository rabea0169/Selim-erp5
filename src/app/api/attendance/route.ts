import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
      const d = new Date(date)
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workerId, date, checkIn, checkOut, status, notes } = body

    // Check if record exists for this worker+date
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const existing = await db.workerAttendance.findFirst({
      where: {
        workerId,
        date: { gte: dayStart, lt: dayEnd },
      },
    })

    if (existing) {
      // Update existing record
      const updated = await db.workerAttendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
          checkOut: checkOut ? new Date(checkOut) : existing.checkOut,
          status: status || existing.status,
          notes: notes !== undefined ? notes : existing.notes,
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
        status: status || 'present',
        notes: notes || null,
      },
      include: { worker: true },
    })
    return NextResponse.json({ attendance: record, created: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
