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
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

    // Fix Q: Date validation
    const fromDate = from ? new Date(from) : undefined
    const toDate = to ? new Date(to) : undefined
    if (from && isNaN(fromDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })
    if (to && isNaN(toDate!.getTime())) return NextResponse.json({ error: 'تاريخ غير صالح' }, { status: 400 })

    const where: any = { companyId }
    if (workerId) where.workerId = workerId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = fromDate
      if (to) {
        toDate!.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const [productions, total] = await Promise.all([
      db.production.findMany({
        where,
        include: { worker: true },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.production.count({ where }),
    ])

    return NextResponse.json({
      productions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const body = await req.json()
    const { workerId, date, modelName, quantity, unitPrice, productId, addToInventory, notes } = body

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
    if (!modelName?.trim()) {
      return NextResponse.json(
        { error: 'اسم الموديل مطلوب' },
        { status: 400 }
      )
    }
    const qty = Number(quantity)
    const price = Number(unitPrice)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { error: 'الكمية يجب أن تكون رقماً موجباً' },
        { status: 400 }
      )
    }
    if (isNaN(price) || price < 0) {
      return NextResponse.json(
        { error: 'سعر القطعة يجب أن يكون رقماً موجباً' },
        { status: 400 }
      )
    }

    // Fix K: Move all checks inside transaction
    let targetProductId = productId || null

    const production = await db.$transaction(async (tx) => {
      // التحقق من وجود الموظف داخل نفس الشركة
      const worker = await tx.worker.findFirst({ where: { id: workerId, companyId } })
      if (!worker) {
        throw new Error('الموظف غير موجود')
      }

      // التحقق من وجود المنتج داخل نفس الشركة
      if (targetProductId) {
        const product = await tx.product.findFirst({ where: { id: targetProductId, companyId } })
        if (!product) {
          throw new Error('المنتج المحدد غير موجود')
        }
      }

      const newProduction = await tx.production.create({
        data: {
          companyId,
          workerId,
          date: new Date(date),
          modelName: modelName.trim(),
          quantity: qty,
          unitPrice: price,
          total: qty * price,
          productId: targetProductId,
          addToInventory: addToInventory !== false,
          notes: notes?.trim() || null,
        },
        include: { worker: true },
      })

      // إضافة الكمية المنتجة لمخزون المنتج (إذا تم تحديد منتج)
      if (targetProductId && addToInventory !== false) {
        await tx.product.update({
          where: { id: targetProductId },
          data: {
            quantity: { increment: qty },
            updatedAt: new Date(),
          },
        })
      }

      return newProduction
    })

    return NextResponse.json({ production })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود'))) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
