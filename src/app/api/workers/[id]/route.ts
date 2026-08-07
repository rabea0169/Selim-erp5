import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// تحويل رقم اختياري: قيمة فارغة/غير صالحة → null
function optNum(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params
    const body = await req.json()
    const { name, phone, job, type, notes, hourlyRate, overtimeRate, workStartTime, workHoursPerDay, monthlySalary } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'اسم الموظف مطلوب' }, { status: 400 })
    }

    // فحص وجود الموظف وتبعيته للشركة (حماية IDOR) — الفلتر إجباري حتى لو companyId null
    const existing = await db.worker.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    const VALID_WORKER_TYPES = ['monthly', 'production', 'hourly']
    if (type && !VALID_WORKER_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع العامل غير صالح' }, { status: 400 })
    }
    const validType = type || 'monthly'

    const worker = await db.worker.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        job: job?.trim() || null,
        type: validType,
        hourlyRate: optNum(hourlyRate),
        overtimeRate: optNum(overtimeRate),
        workStartTime: workStartTime?.trim() || null,
        workHoursPerDay: optNum(workHoursPerDay),
        monthlySalary: optNum(monthlySalary),
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ worker })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null
    const { id } = await params

    // فحص وجود الموظف وتبعيته للشركة (حماية IDOR)
    const existing = await db.worker.findFirst({
      where: { id, companyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 })
    }

    // حذف الموظف - سيتم حذف كل السجلات المرتبطة تلقائياً (Cascade)
    await db.worker.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
