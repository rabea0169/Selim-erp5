import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// نمط تاريخ اليوم YYYY-MM-DD
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

// Fix TZ: توحيد تمثيل "اليوم" — يُخزَّن ظهراً UTC (T12:00Z) فيظهر في نفس اليوم
// بكل المناطق الزمنية (±12 ساعة)، والفلترة تتم بنافذة UTC صريحة
function dayWindowUTC(dayKey: string): { start: Date; end: Date; noon: Date } {
  const start = new Date(`${dayKey}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end, noon: new Date(`${dayKey}T12:00:00.000Z`) }
}

export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')
    const date = searchParams.get('date')

    const where: any = { companyId }
    if (workerId) where.workerId = workerId

    if (date) {
      // فلترة بيوم محدد — نافذة UTC صريحة (تطابق التخزين ظهراً UTC)
      if (DAY_KEY_RE.test(date)) {
        const { start, end } = dayWindowUTC(date)
        where.date = { gte: start, lt: end }
      } else {
        const d = new Date(date)
        d.setUTCHours(0, 0, 0, 0)
        const next = new Date(d)
        next.setUTCDate(next.getUTCDate() + 1)
        where.date = { gte: d, lt: next }
      }
    } else if (from || to) {
      where.date = {}
      if (from) where.date.gte = DAY_KEY_RE.test(from) ? new Date(`${from}T00:00:00.000Z`) : new Date(from)
      if (to) where.date.lt = DAY_KEY_RE.test(to)
        ? (() => { const d = new Date(`${to}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 1); return d })()
        : (() => { const d = new Date(to); d.setUTCHours(23, 59, 59, 999); return d })()
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
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId

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

    // تحديد بداية ونهاية اليوم المحدد — UTC صريح
    const isDayKey = DAY_KEY_RE.test(date)
    let dayStart: Date
    let dayEnd: Date
    let storeDate: Date
    if (isDayKey) {
      const w = dayWindowUTC(date)
      dayStart = w.start
      dayEnd = w.end
      storeDate = w.noon
    } else {
      dayStart = new Date(date)
      dayStart.setUTCHours(0, 0, 0, 0)
      dayEnd = new Date(dayStart)
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
      storeDate = new Date(date)
    }

    // Fix J: Wrap check+create in transaction to prevent race condition
    const result = await db.$transaction(async (tx: any) => {
      // التحقق من وجود الموظف داخل نفس الشركة
      const worker = await tx.worker.findFirst({ where: { id: workerId, companyId } })
      if (!worker) {
        throw new Error('الموظف غير موجود')
      }

      // البحث عن سجل موجود لنفس الموظف في نفس اليوم — داخل الشركة
      const existing = await tx.workerAttendance.findFirst({
        where: {
          workerId,
          companyId,
          date: { gte: dayStart, lt: dayEnd },
        },
      })

      if (existing) {
        // تحديث السجل الموجود — مع توحيد تاريخ التخزين ظهراً UTC
        const updated = await tx.workerAttendance.update({
          where: { id: existing.id },
          data: {
            date: storeDate,
            checkIn: checkIn ? new Date(checkIn) : existing.checkIn,
            checkOut: checkOut ? new Date(checkOut) : existing.checkOut,
            status: validStatus,
            notes: notes !== undefined ? (notes?.trim() || null) : existing.notes,
          },
          include: { worker: true },
        })
        return { attendance: updated, updated: true }
      }

      // إنشاء سجل جديد
      const record = await tx.workerAttendance.create({
        data: {
          companyId,
          workerId,
          date: storeDate,
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          status: validStatus,
          notes: notes?.trim() || null,
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
