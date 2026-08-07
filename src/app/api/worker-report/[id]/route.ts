import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/worker-report/[id]?from=&to=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const worker = await db.worker.findUnique({ where: { id } })
    if (!worker) return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })

    const dateRange: any = {}
    if (from) dateRange.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      dateRange.lte = t
    }
    const filter = from || to ? { date: dateRange } : {}

    const [advances, receipts, attendance, productions] = await Promise.all([
      db.workerAdvance.findMany({ where: { workerId: id, ...filter }, orderBy: { date: 'desc' } }),
      db.workerReceipt.findMany({ where: { workerId: id, ...filter }, orderBy: { date: 'desc' } }),
      db.workerAttendance.findMany({ where: { workerId: id, ...filter }, orderBy: { date: 'desc' } }),
      db.production.findMany({ where: { workerId: id, ...filter }, orderBy: { date: 'desc' } }),
    ])

    const totalAdvances = advances.reduce((s, a) => s + a.amount, 0)
    const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0)
    const totalProduction = productions.reduce((s, p) => s + p.total, 0)
    const totalPieces = productions.reduce((s, p) => s + p.quantity, 0)
    const presentDays = attendance.filter((a) => a.status === 'present').length
    const absentDays = attendance.filter((a) => a.status === 'absent').length

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
