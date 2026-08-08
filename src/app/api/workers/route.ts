import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''

    const where: any = { companyId }
    if (q) {
      where.AND = [
        { companyId },
        {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { job: { contains: q } },
          ],
        },
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

    // Calculate totals
    const workersWithTotals = workers.map((w: any) => {
      const totalAdvances = w.advances.reduce((s: number, a: any) => s + a.amount, 0)
      const totalReceipts = w.receipts.reduce((s: number, r: any) => s + r.amount, 0)
      return {
        ...w,
        totalAdvances,
        totalReceipts,
        balance: totalAdvances - totalReceipts,
      }
    })

    return NextResponse.json({ workers: workersWithTotals })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// تحويل رقم اختياري: قيمة فارغة/غير صالحة → null
function optNum(v: any): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })

    const body = await req.json()
    const { name, phone, job, type, notes, hourlyRate, overtimeRate, workStartTime, workHoursPerDay, monthlySalary } = body

    // التحقق من البيانات
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم الموظف مطلوب' },
        { status: 400 }
      )
    }

    // Fix S: Validate worker type strictly
    const VALID_WORKER_TYPES = ['monthly', 'production', 'hourly']
    if (type && !VALID_WORKER_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع العامل غير صالح' }, { status: 400 })
    }
    const validType = type || 'monthly'

    const worker = await db.worker.create({
      data: {
        companyId: user.companyId ?? null,
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
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
