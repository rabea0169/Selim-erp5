import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
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
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })

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

    // التحقق من الحالة
    const validStatus = ['present', 'absent', 'leave'].includes(status)
      ? status
      : 'present'

    // تحديد بداية ونهاية اليوم المحدد
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    // Fix J: Wrap check+create in transaction to prevent race condition
    const result = await db.$transaction(async (tx) => {
      // التحقق من وجود الموظف
      const worker = await tx.worker.findUnique({ where: { id: workerId } })
      if (!worker) {
        throw new Error('الموظف غير موجود')
      }

      // البحث عن سجل موجود لنفس الموظف في نفس اليوم
      const existing = await tx.workerAttendance.findFirst({
        where: {
          workerId,
          date: { gte: dayStart, lt: dayEnd },
        },
      })

      if (existing) {
        // حساب ساعات العمل
        const ci = checkIn ? new Date(checkIn) : existing.checkIn
        const co = checkOut ? new Date(checkOut) : existing.checkOut
        const workHours = ci && co ? Math.max(0, (co.getTime() - ci.getTime()) / 3600000) : null
        const lateMinutes = ci && worker.shiftStart
          ? Math.max(0, Math.round((ci.getTime() - new Date(worker.shiftStart).getTime()) / 60000))
          : null
        const overtimeHours = co && worker.shiftEnd
          ? Math.max(0, (co.getTime() - new Date(worker.shiftEnd).getTime()) / 3600000)
          : null

        // تحديث السجل الموجود
        const updated = await tx.workerAttendance.update({
          where: { id: existing.id },
          data: {
            checkIn: ci,
            checkOut: co,
            status: validStatus,
            notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
            workHours,
            lateMinutes,
            overtimeHours,
          },
          include: { worker: true },
        })
        return { attendance: updated, updated: true }
      }

      // حساب ساعات العمل للسجل الجديد
      const ci = checkIn ? new Date(checkIn) : null
      const co = checkOut ? new Date(checkOut) : null
      const workHours = ci && co ? Math.max(0, (co.getTime() - ci.getTime()) / 3600000) : null
      const lateMinutes = ci && (worker as any).shiftStart
        ? Math.max(0, Math.round((ci.getTime() - new Date((worker as any).shiftStart).getTime()) / 60000))
        : null
      const overtimeHours = co && (worker as any).shiftEnd
        ? Math.max(0, (co.getTime() - new Date((worker as any).shiftEnd).getTime()) / 3600000)
        : null

      // إنشاء سجل جديد
      const record = await tx.workerAttendance.create({
        data: {
          workerId,
          date: new Date(date),
          checkIn: ci,
          checkOut: co,
          status: validStatus,
          notes: notes?.trim() || null,
          workHours,
          lateMinutes,
          overtimeHours,
          companyId: scope.companyId,
        },
        include: { worker: true },
      })
      return { attendance: record, created: true }
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof Error && e.message.includes('غير موجود')) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
