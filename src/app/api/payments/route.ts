import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'

import { safeError } from '@/lib/safe-error'

// GET /api/payments?type=customer_payment&partyId=xxx&from=&to=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const partyId = searchParams.get('partyId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit')) || 50))
    const skip = (page - 1) * limit

    const where: any = scope.companyId ? { companyId: scope.companyId } : {}
    if (type) {
      where.type = type
    }
    if (partyId) {
      where.partyId = partyId
    }
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
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

    if (!partyId?.trim()) {
      return NextResponse.json(
        { error: type === 'customer_payment' ? 'العميل مطلوب' : 'المورد مطلوب' },
        { status: 400 }
      )
    }
    if (!partyName?.trim()) {
      return NextResponse.json(
        { error: 'اسم الطرف مطلوب' },
        { status: 400 }
      )
    }

    // تحديد customerId أو supplierId بناءً على نوع الدفعة
    const customerId = type === 'customer_payment' ? partyId.trim() : null
    const supplierId = type === 'supplier_payment' ? partyId.trim() : null

    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }

    const amountNumber = Number(amount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    const payment = await db.$transaction(async (tx) => {
      let sale: any = null
      let purchase: any = null

      if (invoiceId?.trim()) {
        if (type === 'customer_payment') {
          sale = await tx.sale.findFirst({
            where: { id: invoiceId.trim(), ...(scope.companyId ? { companyId: scope.companyId } : {}) },
          })
          if (!sale) {
            throw new Error('فاتورة البيع المحددة غير موجودة')
          }
          const remaining = sale.total - sale.paid
          if (amountNumber > remaining) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي (${remaining})`)
          }
        } else {
          purchase = await tx.purchase.findFirst({
            where: { id: invoiceId.trim(), ...(scope.companyId ? { companyId: scope.companyId } : {}) },
          })
          if (!purchase) {
            throw new Error('فاتورة الشراء المحددة غير موجودة')
          }
          const remaining = purchase.total - purchase.paid
          if (amountNumber > remaining) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي (${remaining})`)
          }
        }
      }

      const newPayment = await tx.payment.create({
        data: {
          companyId: scope.companyId || null,
          type,
          partyId: partyId.trim(),
          partyName: partyName.trim(),
          customerId,
          supplierId,
          invoiceId: invoiceId?.trim() || null,
          invoiceNo: invoiceNo?.trim() || null,
          amount: amountNumber,
          date: new Date(date),
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
            companyId: scope.companyId || null,
            type: 'deposit',
            amount: amountNumber,
            date: new Date(date),
            description: `تحصيل من عميل - ${partyName.trim()}`,
            category: 'سدادات عملاء',
            referenceType: 'payment',
            referenceId: newPayment.id,
            notes: invoiceNo?.trim()
              ? `فاتورة رقم ${invoiceNo.trim()}`
              : notes?.trim() || null,
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
            companyId: scope.companyId || null,
            type: 'withdrawal',
            amount: amountNumber,
            date: new Date(date),
            description: `سداد لمورد - ${partyName.trim()}`,
            category: 'سدادات موردين',
            referenceType: 'payment',
            referenceId: newPayment.id,
            notes: invoiceNo?.trim()
              ? `فاتورة رقم ${invoiceNo.trim()}`
              : notes?.trim() || null,
          },
        })
      }

      return newPayment
    })

    return NextResponse.json({ payment })
  } catch (e) {
    if (e instanceof Error && e.message.includes('يتجاوز الرصيد المتبقي')) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (e instanceof Error && (e.message.includes('غير موجودة') || e.message.includes('غير صالح'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
