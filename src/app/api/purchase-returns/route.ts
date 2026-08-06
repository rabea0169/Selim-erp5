import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const purchaseId = searchParams.get('purchaseId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user.companyId ? { companyId: user.companyId } : {}
    if (purchaseId) where.purchaseId = purchaseId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.date.lte = d }
    }

    const [returns, total] = await Promise.all([
      db.purchaseReturn.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.purchaseReturn.count({ where }),
    ])

    return NextResponse.json({ returns, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const body = await req.json()
    const { purchaseId, invoiceNo, supplierName, supplierId_ref, date, total, reason, restockItems, items, notes } = body

    if (!purchaseId || !supplierName || !date) {
      return NextResponse.json({ error: 'بيانات مطلوبة ناقصة' }, { status: 400 })
    }

    const purchaseReturn = await db.$transaction(async (tx) => {
      // التحقق من ملكية فاتورة الشراء لنفس الشركة (حماية IDOR)
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, ...(user.companyId ? { companyId: user.companyId } : {}) },
      })
      if (!purchase) throw new Error('فاتورة الشراء غير موجودة')
      if (Number(total) > purchase.total) throw new Error('قيمة المرتجع لا يمكن أن تتجاوز إجمالي فاتورة الشراء')

      const ret = await tx.purchaseReturn.create({
        data: {
          companyId: user.companyId || null,
          returnNumber: `PR-${Date.now()}`,
          purchaseId,
          invoiceNo: invoiceNo?.trim() || null,
          supplierName: supplierName.trim(),
          supplierId_ref: supplierId_ref || null,
          date: new Date(date),
          total: Number(total) || 0,
          reason: reason?.trim() || null,
          items: items || [],
          notes: notes?.trim() || null,
        },
      })

      // إعادة الخامات للمخزن
      if (restockItems !== false && Array.isArray(items)) {
        for (const it of items) {
          if (it.materialId) {
            await tx.material.update({
              where: { id: it.materialId },
              data: { quantity: { decrement: Number(it.quantity) }, updatedAt: new Date() },
            })

            // تسجيل حركة خروج من مخزن الخامات
            const mat = await tx.material.findUnique({ where: { id: it.materialId } })
            if (mat) {
              await tx.materialTransaction.create({
                data: {
                  companyId: user.companyId || null,
                  materialId: it.materialId,
                  warehouseId: mat.warehouseId,
                  type: 'out',
                  quantity: Number(it.quantity),
                  unitCost: mat.unitCost,
                  date: new Date(date),
                  reason: `مرتجع مشتريات PR-${Date.now()}`,
                  referenceType: 'purchase_return',
                  referenceId: ret.id,
                },
              })
            }
          }
        }
      }

      // تخفيض المبلغ المدفوع للمورد
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { paid: { decrement: ret.total } },
      })

      // إيداع قيمة المرتجع في الخزينة
      if (ret.total > 0) {
        await tx.treasuryTransaction.create({
          data: {
            companyId: user.companyId || null,
            type: 'deposit',
            amount: ret.total,
            date: new Date(date),
            description: `مرتجع مشتريات - ${supplierName}`,
            category: 'مرتجعات مشتريات',
            referenceType: 'purchase_return',
            referenceId: ret.id,
            notes: invoiceNo ? `فاتورة رقم ${invoiceNo}` : null,
          },
        })
      }

      return ret
    })

    return NextResponse.json({ return: purchaseReturn })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجودة') || e.message.includes('لا يمكن'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
