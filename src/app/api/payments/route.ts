import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'
import { Decimal } from '@prisma/client/runtime/library'

// GET /api/payments
export async function GET(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    const companyId = scope.companyId

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const customerId = searchParams.get('customerId')
    const supplierId = searchParams.get('supplierId')
    const invoiceId = searchParams.get('invoiceId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = { companyId }
    if (type) where.type = type
    if (customerId) where.customerId = customerId
    if (supplierId) where.supplierId = supplierId
    if (invoiceId) where.invoiceId = invoiceId

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          customer: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
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
      customerId,
      supplierId,
      invoiceId,
      invoiceNo,
      amount,
      date,
      method,
      referenceNumber,
      notes,
    } = body

    // التحقق من نوع السداد
    if (type !== 'customer_payment' && type !== 'supplier_payment') {
      return NextResponse.json(
        { error: 'نوع السداد غير صالح (يجب أن يكون customer_payment أو supplier_payment)' },
        { status: 400 }
      )
    }

    // التحقق من المبلغ
    const amountNumber = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // التحقق من طريقة السداد
    const validMethods = ['cash', 'check', 'bank_transfer', 'credit_card']
    if (method && !validMethods.includes(method)) {
      return NextResponse.json(
        { error: `طريقة السداد غير صالحة. الخيارات المتاحة: ${validMethods.join(', ')}` },
        { status: 400 }
      )
    }

    // إنشاء السداد في transaction
    const payment = await db.$transaction(async (tx) => {
      let validCustomerId: string | null = null
      let validSupplierId: string | null = null
      let invoice: any = null

      // التحقق من العميل أو المورد
      if (type === 'customer_payment') {
        if (!customerId && !invoiceId) {
          throw new Error('معرف العميل أو معرف الفاتورة مطلوب')
        }

        if (customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: customerId, companyId },
          })
          if (!customer) {
            throw new Error('العميل المحدد غير موجود')
          }
          validCustomerId = customer.id
        }

        // التحقق من الفاتورة إن وجدت
        if (invoiceId) {
          invoice = await tx.sale.findUnique({
            where: { id: invoiceId },
          })
          if (!invoice) {
            throw new Error('فاتورة البيع المحددة غير موجودة')
          }

          // التحقق من عدم تجاوز المبلغ المستحق
          const remaining = new Decimal(invoice.total).minus(new Decimal(invoice.paid))
          if (new Decimal(amountNumber).greaterThan(remaining)) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining.toNumber()})`)
          }

          if (!validCustomerId) {
            validCustomerId = invoice.customerId
          }
        }
      } else {
        // supplier_payment
        if (!supplierId && !invoiceId) {
          throw new Error('معرف المورد أو معرف الفاتورة مطلوب')
        }

        if (supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: supplierId, companyId },
          })
          if (!supplier) {
            throw new Error('المورد المحدد غير موجود')
          }
          validSupplierId = supplier.id
        }

        // التحقق من الفاتورة إن وجدت
        if (invoiceId) {
          invoice = await tx.purchase.findUnique({
            where: { id: invoiceId },
          })
          if (!invoice) {
            throw new Error('فاتورة الشراء المحددة غير موجودة')
          }

          // التحقق من عدم تجاوز المبلغ المستحق
          const remaining = new Decimal(invoice.total).minus(new Decimal(invoice.paid))
          if (new Decimal(amountNumber).greaterThan(remaining)) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining.toNumber()})`)
          }

          if (!validSupplierId) {
            validSupplierId = invoice.supplierId
          }
        }
      }

      // إنشاء السداد
      // الحصول على اسم العميل أو المورد
      let partyName = ''
      if (type === 'customer_payment' && validCustomerId) {
        const customer = await tx.customer.findUnique({
          where: { id: validCustomerId },
          select: { name: true },
        })
        partyName = customer?.name || 'عميل'
      } else if (type === 'supplier_payment' && validSupplierId) {
        const supplier = await tx.supplier.findUnique({
          where: { id: validSupplierId },
          select: { name: true },
        })
        partyName = supplier?.name || 'مورد'
      }

      const newPayment = await tx.payment.create({
        data: {
          companyId,
          type,
          partyId: type === 'customer_payment' ? (validCustomerId || 'unlinked') : (validSupplierId || 'unlinked'),
          partyName: partyName || (type === 'customer_payment' ? 'عميل' : 'مورد'),
          customerId: type === 'customer_payment' ? validCustomerId : null,
          supplierId: type === 'supplier_payment' ? validSupplierId : null,
          invoiceId: invoiceId?.trim() || null,
          invoiceNo: invoiceNo?.trim() || null,
          amount: new Decimal(amountNumber),
          date: new Date(date || Date.now()),
          method: method?.trim() || 'cash',
          notes: notes?.trim() || null,
        },
      })

      // تحديث الفاتورة إن وجدت
      if (invoice) {
        if (type === 'customer_payment') {
          await tx.sale.update({
            where: { id: invoice.id },
            data: { paid: new Decimal(invoice.paid).plus(new Decimal(amountNumber)) },
          })
        } else {
          await tx.purchase.update({
            where: { id: invoice.id },
            data: { paid: new Decimal(invoice.paid).plus(new Decimal(amountNumber)) },
          })
        }
      }

      // تسجيل في خزينة الشركة
      await tx.treasuryTransaction.create({
        data: {
          companyId,
          type: type === 'customer_payment' ? 'deposit' : 'withdrawal',
          amount: new Decimal(amountNumber),
          date: new Date(date || Date.now()),
          description: type === 'customer_payment' 
            ? `تحصيل من عميل - ${validCustomerId}`
            : `سداد لمورد - ${validSupplierId}`,
          category: type === 'customer_payment' ? 'سدادات عملاء' : 'سدادات موردين',
          referenceType: 'payment',
          referenceId: newPayment.id,
          notes: invoiceNo?.trim() ? `فاتورة رقم ${invoiceNo.trim()}` : notes?.trim() || null,
        },
      })

      return newPayment
    })

    return NextResponse.json({ payment }, { status: 201 })
  } catch (e: any) {
    const { error, status } = safeError(e, 400)
    return NextResponse.json({ error }, { status })
  }
}
