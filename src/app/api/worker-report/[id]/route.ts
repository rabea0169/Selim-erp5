import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/worker-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const worker = await db.worker.findFirst({ where: { id, companyId } })
    if (!worker) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const filter: any = { workerId: id, companyId }
    if (from || to) filter.date = dateRange

    const [advances, receipts, attendance, productions] = await Promise.all([
      db.workerAdvance.findMany({ where: filter, orderBy: { date: 'desc' } }),
      db.workerReceipt.findMany({ where: filter, orderBy: { date: 'desc' } }),
      db.workerAttendance.findMany({ where: filter, orderBy: { date: 'desc' } }),
      db.production.findMany({ where: filter, orderBy: { date: 'desc' } }),
    ])

    const totalAdvances = advances.reduce((s: number, a: any) => s + a.amount, 0)
    const totalReceipts = receipts.reduce((s: number, r: any) => s + r.amount, 0)
    const totalProduction = productions.reduce((s: number, p: any) => s + p.total, 0)
    const totalPieces = productions.reduce((s: number, p: any) => s + p.quantity, 0)
    const presentDays = attendance.filter((a: any) => a.status === 'present').length
    const absentDays = attendance.filter((a: any) => a.status === 'absent').length

    return NextResponse.json({
      worker,
      range: { from, to },
      summary: {
        totalAdvances,
        totalReceipts,
        balance: totalAdvances - totalReceipts,
        totalProduction,
        totalPieces,
        presentDays,
        absentDays,
        totalDays: attendance.length,
      },
      advances,
      receipts,
      attendance,
      productions,
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
