import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// POST /api/products/[id]/stock — إضافة أو صرف رصيد منتج
// body: { quantity, type: 'in' | 'out', reason }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    const companyId = scope.companyId
    const { id } = await params

    const body = await req.json()
    const { quantity, type, reason } = body

    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً موجباً' }, { status: 400 })
    }
    if (type !== 'in' && type !== 'out') {
      return NextResponse.json({ error: 'نوع الحركة يجب أن يكون in أو out' }, { status: 400 })
    }

    const product = await db.$transaction(async (tx: any) => {
      // التحقق من المنتج داخل نفس الشركة (منع IDOR)
      const existing = await tx.product.findFirst({ where: { id, companyId } })
      if (!existing) {
        throw new Error('المنتج غير موجود')
      }
      if (type === 'out' && existing.quantity < qty) {
        throw new Error(`الكمية المتاحة (${existing.quantity}) أقل من المطلوب صرفه (${qty})`)
      }

      return tx.product.update({
        where: { id },
        data: {
          quantity: type === 'in' ? { increment: qty } : { decrement: qty },
          updatedAt: new Date(),
        },
      })
    })

    return NextResponse.json({ product })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجود') || e.message.includes('أقل من'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
