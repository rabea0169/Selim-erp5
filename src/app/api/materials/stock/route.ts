import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'
import { weightedAverageCost } from '@/lib/calc'

// POST /api/materials/stock — إضافة أو صرف أو تسوية رصيد مادة خام مع تسجيل حركة مخزن
// body: { materialId, quantity, type: 'in' | 'out' | 'adjustment', unitCost?, reason, referenceType?, referenceId?, notes? }
// - in: إدخال كمية — يُعاد حساب unitCost بمتوسط التكلفة المرجح إذا أُرسلت تكلفة
// - out: إخراج كمية — ممنوع صرف أكثر من المتاح
// - adjustment: تسوية جرد — quantity هي الرصيد الجديد المطلق
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = user.companyId ?? null

    const body = await req.json()
    const { materialId, quantity, type, unitCost, reason, referenceType, referenceId, notes } = body

    if (!materialId) {
      return NextResponse.json({ error: 'المادة مطلوبة' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (isNaN(qty) || qty < 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً غير سالب' }, { status: 400 })
    }
    if (type !== 'in' && type !== 'out' && type !== 'adjustment') {
      return NextResponse.json({ error: 'نوع الحركة يجب أن يكون in أو out أو adjustment' }, { status: 400 })
    }
    if (type !== 'adjustment' && qty <= 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً موجباً' }, { status: 400 })
    }
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'سبب الحركة مطلوب' }, { status: 400 })
    }
    if (type === 'in' && unitCost != null && (isNaN(Number(unitCost)) || Number(unitCost) < 0)) {
      return NextResponse.json({ error: 'تكلفة الوحدة يجب أن تكون رقماً غير سالب' }, { status: 400 })
    }

    const result = await db.$transaction(async (tx) => {
      // التحقق من المادة داخل نفس الشركة (منع IDOR)
      const material = await tx.material.findFirst({ where: { id: materialId, companyId } })
      if (!material) {
        throw new Error('المادة غير موجودة')
      }

      if (type === 'out' && material.quantity < qty) {
        throw new Error(`الكمية المتاحة (${material.quantity}) أقل من المطلوب صرفه (${qty})`)
      }

      // حساب الرصيد والتكلفة الجديدين + كمية الحركة المسجلة
      let updateData: Record<string, unknown>
      let transactionQty = qty
      let transactionUnitCost = unitCost != null ? Number(unitCost) : material.unitCost

      if (type === 'in') {
        // متوسط التكلفة المرجح عند الإدخال بتكلفة جديدة
        const newUnitCost =
          unitCost != null
            ? weightedAverageCost(material.quantity, material.unitCost, qty, Number(unitCost))
            : material.unitCost
        updateData = { quantity: { increment: qty }, unitCost: newUnitCost, updatedAt: new Date() }
      } else if (type === 'out') {
        updateData = { quantity: { decrement: qty }, updatedAt: new Date() }
        transactionUnitCost = material.unitCost
      } else {
        // تسوية: quantity هي الرصيد الجديد المطلق — نسجل فرق الجرد في الحركة
        transactionQty = Math.abs(qty - material.quantity)
        updateData = { quantity: qty, updatedAt: new Date() }
      }

      // تحديث ذري للرصيد
      const updated = await tx.material.update({
        where: { id: materialId },
        data: updateData,
      })

      const transaction = await tx.materialTransaction.create({
        data: {
          companyId,
          materialId,
          warehouseId: material.warehouseId,
          type,
          quantity: transactionQty,
          unitCost: transactionUnitCost,
          date: new Date(),
          reason: reason.trim(),
          referenceType: referenceType || null,
          referenceId: referenceId || null,
          notes: notes?.trim() || null,
        },
      })

      return { material: updated, transaction }
    })

    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجودة') || e.message.includes('أقل من'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
