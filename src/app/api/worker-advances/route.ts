import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')

    const where: any = {}
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

    const advances = await db.workerAdvance.findMany({
      where,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ advances })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workerId, companyId, amount, date, notes } = body

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

    // التحقق من وجود الموظف
    const worker = await db.worker.findUnique({ where: { id: workerId } })
    if (!worker) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    const advance = await db.$transaction(async (tx) => {
      const adv = await tx.workerAdvance.create({
        data: {
          workerId,
          companyId: companyId || null,
          amount: amt,
          date: new Date(date),
          notes: notes?.trim() || null,
        },
        include: { worker: true },
      })

      // إنشاء حركة سحب في الخزينة لسلفة الموظف
      await tx.treasuryTransaction.create({
        data: {
          type: 'withdrawal',
          amount: amt,
          date: new Date(date),
          description: `سلفة موظف: ${worker.name}`,
          category: 'سلف موظفين',
          referenceType: 'worker_advance',
          referenceId: adv.id,
          notes: notes?.trim() || null,
        },
      })

      return adv
    })
    return NextResponse.json({ advance })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}