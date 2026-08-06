import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { workerSchema } from '@/lib/validations'

// GET /api/workers?q=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user?.companyId ? { companyId: user.companyId } : {}
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { job: { contains: q } },
      ]
    }

    const [workers, total] = await Promise.all([
      db.worker.findMany({
        where,
        include: {
          advances: { orderBy: { date: 'desc' } },
          receipts: { orderBy: { date: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.worker.count({ where }),
    ])

    const workersWithTotals = workers.map((w) => {
      const totalAdvances = w.advances.reduce((s, a) => s + a.amount, 0)
      const totalReceipts = w.receipts.reduce((s, r) => s + r.amount, 0)
      return {
        ...w,
        totalAdvances,
        totalReceipts,
        balance: totalAdvances - totalReceipts,
      }
    })

    return NextResponse.json({
      workers: workersWithTotals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const body = await req.json()

    // التحقق من البيانات باستخدام Zod
    const validation = workerSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => i.message).join('، ')
      return NextResponse.json({ error: errors }, { status: 400 })
    }

    const { name, phone, job, type, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم الموظف مطلوب' },
        { status: 400 }
      )
    }

    const VALID_WORKER_TYPES = ['monthly', 'production', 'hourly']
    if (type && !VALID_WORKER_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع العامل غير صالح' }, { status: 400 })
    }
    const validType = type || 'monthly'

    const worker = await db.worker.create({
      data: {
        companyId: user?.companyId || null,
        name: name.trim(),
        phone: phone?.trim() || null,
        job: job?.trim() || null,
        type: validType,
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ worker })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
