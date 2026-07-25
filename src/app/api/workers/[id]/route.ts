import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'

function numOrNull(value: unknown): number | null {
  const n = Number(value)
  return value === null || value === undefined || value === '' || isNaN(n) ? null : n
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('update')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await req.json()
    const { name, phone, job, type, notes, hourlyRate, overtimeRate, workStartTime, workHoursPerDay, monthlySalary } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الموظف مطلوب' }, { status: 400 })
    }

    const existing = await db.worker.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    const validType = type === 'production' || type === 'hourly' ? type : 'monthly'

    const worker = await db.worker.update({
      where: { id },
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
      },
    })
    return NextResponse.json({ worker })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth('delete')
    if (!auth.authorized) return auth.response

    const { id } = await params

    const existing = await db.worker.findFirst({ where: { id, companyId: auth.companyId } })
    if (!existing) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    await db.worker.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
