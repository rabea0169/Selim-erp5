import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')

    // عزل الشركات إجباري
    const where: any = { companyId }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
    if (workerId) where.workerId = workerId

    const receipts = await db.workerReceipt.findMany({
      where,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    // المفتاح workerReceipts كما يتوقع العميل (contract fix)
    return NextResponse.json({ workerReceipts: receipts })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const companyId = user.companyId ?? null

    const body = await req.json()
    // companyId لا يُقبل من العميل أبداً — يُؤخذ من الجلسة فقط (منع الحقن عبر الشركات)
    const { workerId, amount, date, notes } = body

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
    const amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون رقماً موجباً' },
        { status: 400 }
      )
    }

    // التحقق من وجود الموظف داخل نفس الشركة
    const worker = await db.worker.findFirst({ where: { id: workerId, companyId } })
    if (!worker) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    const receipt = await db.$transaction(async (tx) => {
      const rcpt = await tx.workerReceipt.create({
        data: {
          workerId,
          companyId,
          amount: amt,
          date: new Date(date),
          notes: notes?.trim() || null,
        },
        include: { worker: true },
      })

      await tx.treasuryTransaction.create({
        data: {
          companyId,
          type: 'deposit',
          amount: amt,
          date: new Date(date),
          description: `استلام - ${worker.name}`,
          category: 'عامل',
          referenceType: 'worker_receipt',
          referenceId: rcpt.id,
        },
      })

      return rcpt
    })
    // المفتاح workerReceipt كما يتوقع العميل (contract fix)
    return NextResponse.json({ workerReceipt: receipt })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
