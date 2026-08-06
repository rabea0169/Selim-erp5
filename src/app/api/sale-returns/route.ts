import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const saleId = searchParams.get('saleId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user.companyId ? { companyId: user.companyId } : {}
    if (saleId) where.saleId = saleId
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where.date.lte = d }
    }

    const [returns, total] = await Promise.all([
      db.saleReturn.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.saleReturn.count({ where }),
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
    const { saleId, date, total, reason, notes, items, returnNumber, customerName } = body

    if (!saleId || !date || !total) {
      return NextResponse.json({ error: 'بيانات المرتجع غير مكتملة' }, { status: 400 })
    }

    const retNum = returnNumber || `RET-${Date.now()}`

    const ret = await db.$transaction(async (tx) => {
      // التحقق من ملكية الفاتورة لنفس الشركة (حماية IDOR)
      const sale = await tx.sale.findFirst({
        where: { id: saleId, ...(user.companyId ? { companyId: user.companyId } : {}) },
        include: { items: true },
      })
      if (!sale) throw new Error('الفاتورة غير موجودة')
      if (Number(total) > sale.total) throw new Error('قيمة المرتجع لا يمكن أن تتجاوز إجمالي الفاتورة')

      const cName = customerName || sale.customerName || ''

      const saleReturn = await tx.saleReturn.create({
        data: {
          companyId: user.companyId || null,
          returnNumber: retNum,
          saleId,
          invoiceNo: sale.invoiceNo,
          customerName: cName,
          customerId_ref: sale.customerId_ref,
          date: new Date(date),
          total: Number(total),
          items: Array.isArray(items) ? items : [],
          reason: reason?.trim() || null,
          notes: notes?.trim() || null,
        },
      })

      // إعادة المنتجات للمخزن
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.productId && item.quantity > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { quantity: { increment: Number(item.quantity) } },
            })
          }
        }
      }

      // سحب من الخزينة بقيمة المرتجع
      await tx.treasuryTransaction.create({
        data: {
          companyId: user.companyId || null,
          type: 'withdrawal',
          amount: Number(total),
          date: new Date(date),
          description: `مرتجع مبيعات - ${sale.customerName}`,
          category: 'مرتجعات',
          referenceType: 'sale_return',
          referenceId: saleReturn.id,
        },
      })

      // تخفيض المبلغ المدفوع على الفاتورة
      const newPaid = Math.max(0, sale.paid - Number(total))
      await tx.sale.update({ where: { id: saleId }, data: { paid: newPaid } })

      return saleReturn
    })

    return NextResponse.json({ return: ret })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('غير موجودة') || e.message.includes('لا يمكن'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
