import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// POST /api/materials/stock — إضافة أو صرف رصيد مادة خام مع تسجيل حركة مخزن
// body: { materialId, quantity, type: 'in' | 'out', unitCost?, reason, referenceType?, referenceId?, notes? }
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
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً موجباً' }, { status: 400 })
    }
    if (type !== 'in' && type !== 'out') {
      return NextResponse.json({ error: 'نوع الحركة يجب أن يكون in أو out' }, { status: 400 })
    }
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'سبب الحركة مطلوب' }, { status: 400 })
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

      // تحديث ذري للرصيد
      const updated = await tx.material.update({
        where: { id: materialId },
        data: {
          quantity: type === 'in' ? { increment: qty } : { decrement: qty },
          updatedAt: new Date(),
        },
      })

      const transaction = await tx.materialTransaction.create({
        data: {
          companyId,
          materialId,
          warehouseId: material.warehouseId,
          type,
          quantity: qty,
          unitCost: unitCost != null ? Number(unitCost) : material.unitCost,
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
