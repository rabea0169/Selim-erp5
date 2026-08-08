import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

// GET /api/payments
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const partyId = searchParams.get('partyId')
    const invoiceId = searchParams.get('invoiceId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = { companyId }
    if (type) where.type = type
    if (partyId) where.partyId = partyId
    if (invoiceId) where.invoiceId = invoiceId

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.payment.count({ where }),
    ])

    return NextResponse.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

// POST /api/payments
export async function POST(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const companyId = scope.companyId

    const body = await req.json()
    const {
      type,
      partyId,
      partyName,
      invoiceId,
      invoiceNo,
      amount,
      date,
      method,
      notes,
    } = body

    if (type !== 'customer_payment' && type !== 'supplier_payment') {
      return NextResponse.json(
        { error: 'نوع السداد غير صالح (يجب أن يكون customer_payment أو supplier_payment)' },
        { status: 400 }
      )
    }

    const pName = partyName?.trim() || (type === 'customer_payment' ? 'عميل' : 'مورد')
    const pId = partyId?.trim() || invoiceId?.trim() || 'unlinked'

    const amountNumber = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    const payment = await db.$transaction(async (tx) => {
      let sale: any = null
      let purchase: any = null
      let validCustomerId: string | null = null
      let validSupplierId: string | null = null

      if (type === 'customer_payment') {
        if (pId && pId !== 'unlinked') {
          const cust = await tx.customer.findFirst({
            where: { id: pId, ...(companyId ? { companyId } : {}) },
          })
          if (cust) validCustomerId = cust.id
        }
      } else {
        if (pId && pId !== 'unlinked') {
          const supp = await tx.supplier.findFirst({
            where: { id: pId, ...(companyId ? { companyId } : {}) },
          })
          if (supp) validSupplierId = supp.id
        }
      }

      if (invoiceId?.trim()) {
        if (type === 'customer_payment') {
          sale = await tx.sale.findUnique({ where: { id: invoiceId.trim() } })
          if (!sale) {
            throw new Error('فاتورة البيع المحددة غير موجودة')
          }
          const remaining = Math.round((sale.total - sale.paid) * 100) / 100
          if (amountNumber - remaining > 0.01) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining})`)
          }
          if (!validCustomerId && sale.customerId_ref) {
            const cust = await tx.customer.findFirst({ where: { id: sale.customerId_ref } })
            if (cust) validCustomerId = cust.id
          }
        } else {
          purchase = await tx.purchase.findUnique({ where: { id: invoiceId.trim() } })
          if (!purchase) {
            throw new Error('فاتورة الشراء المحددة غير موجودة')
          }
          const remaining = Math.round((purchase.total - purchase.paid) * 100) / 100
          if (amountNumber - remaining > 0.01) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining})`)
          }
          if (!validSupplierId && purchase.supplierId_ref) {
            const supp = await tx.supplier.findFirst({ where: { id: purchase.supplierId_ref } })
            if (supp) validSupplierId = supp.id
          }
        }
      }

      const newPayment = await tx.payment.create({
        data: {
          companyId,
          type,
          partyId: pId,
          partyName: pName,
          customerId: validCustomerId,
          supplierId: validSupplierId,
          invoiceId: invoiceId?.trim() || null,
          invoiceNo: invoiceNo?.trim() || null,
          amount: amountNumber,
          date: new Date(date || Date.now()),
          method: method?.trim() || null,
          notes: notes?.trim() || null,
        },
      })

      if (type === 'customer_payment') {
        if (sale) {
          await tx.sale.update({
            where: { id: sale.id },
            data: { paid: { increment: amountNumber } },
          })
        }
        await tx.treasuryTransaction.create({
          data: {
            companyId,
            type: 'deposit',
            amount: amountNumber,
            date: new Date(date || Date.now()),
            description: `تحصيل من عميل - ${pName}`,
            category: 'سدادات عملاء',
            referenceType: 'payment',
            referenceId: newPayment.id,
            notes: invoiceNo?.trim() ? `فاتورة رقم ${invoiceNo.trim()}` : notes?.trim() || null,
          },
        })
      } else {
        if (purchase) {
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paid: { increment: amountNumber } },
          })
        }
        await tx.treasuryTransaction.create({
          data: {
            companyId,
            type: 'withdrawal',
            amount: amountNumber,
            date: new Date(date || Date.now()),
            description: `سداد لمورد - ${pName}`,
            category: 'سدادات موردين',
            referenceType: 'payment',
            referenceId: newPayment.id,
            notes: invoiceNo?.trim() ? `فاتورة رقم ${invoiceNo.trim()}` : notes?.trim() || null,
          },
        })
      }

      return newPayment
    })

    return NextResponse.json({ payment })
  } catch (e: any) {
    const { error, status } = safeError(e, 400)
    return NextResponse.json({ error }, { status })
  }
}
