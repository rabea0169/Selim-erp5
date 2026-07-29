import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const workerId = searchParams.get('workerId')

    const where: any = {}
    if (workerId) where.workerId = workerId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const productions = await db.production.findMany({
      where,
      include: { worker: true },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ productions })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
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

    // التحقق من وجود الموظف
    const worker = await db.worker.findUnique({ where: { id: workerId } })
    if (!worker) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    // ===== ربط إنتاج العمال بالمخزون =====
    // إذا تم تحديد منتج وطلب إضافته للمخزون
    let targetProductId = productId || null
    if (targetProductId) {
      const product = await db.product.findUnique({ where: { id: targetProductId } })
      if (!product) {
        return NextResponse.json(
          { error: 'المنتج المحدد غير موجود' },
          { status: 404 }
        )
      }
    }

    const production = await db.$transaction(async (tx) => {
      const newProduction = await tx.production.create({
        data: {
          workerId,
          date: new Date(date),
          modelName: modelName.trim(),
          quantity: qty,
          unitPrice: price,
          total: qty * price,
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
