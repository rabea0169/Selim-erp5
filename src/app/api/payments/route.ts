import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

// GET /api/payments?type=customer_payment&partyId=xxx&from=&to=&page=1&limit=50
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const partyId = searchParams.get('partyId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit')) || 50))
    const skip = (page - 1) * limit

    const where: any = {}
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
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

// POST /api/payments
export async function POST(req: NextRequest) {
  try {
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

    // التحقق من نوع السداد
    if (type !== 'customer_payment' && type !== 'supplier_payment') {
      return NextResponse.json(
        { error: 'نوع السداد غير صالح (يجب أن يكون customer_payment أو supplier_payment)' },
        { status: 400 }
      )
    }

    // التحقق من بيانات الطرف
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

    // التحقق من التاريخ
    if (!date) {
      return NextResponse.json(
        { error: 'التاريخ مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من المبلغ
    const amountNumber = Number(amount)
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // تنفيذ العملية في transaction واحد
    const payment = await db.$transaction(async (tx) => {
      // التحقق من الفاتورة وربطها حسب النوع
      let sale: any = null
      let purchase: any = null

      if (invoiceId?.trim()) {
        if (type === 'customer_payment') {
          sale = await tx.sale.findUnique({ where: { id: invoiceId.trim() } })
          if (!sale) {
            throw new Error('فاتورة البيع المحددة غير موجودة')
          }
        } else {
          purchase = await tx.purchase.findUnique({ where: { id: invoiceId.trim() } })
          if (!purchase) {
            throw new Error('فاتورة الشراء المحددة غير موجودة')
          }
        }
      }

      // إنشاء سجل السداد
      const newPayment = await tx.payment.create({
        data: {
          type,
          partyId: partyId.trim(),
          partyName: partyName.trim(),
          invoiceId: invoiceId?.trim() || null,
          invoiceNo: invoiceNo?.trim() || null,
          amount: amountNumber,
          date: new Date(date),
          method: method?.trim() || null,
          notes: notes?.trim() || null,
        },
      })

      // تحديث الفاتورة وإنشاء حركة خزينة حسب النوع
      if (type === 'customer_payment') {
        // سداد من عميل = إيداع في الخزينة
        if (sale) {
          await tx.sale.update({
            where: { id: sale.id },
            data: { paid: { increment: amountNumber } },
          })
        }
        await tx.treasuryTransaction.create({
          data: {
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
        // سداد لمورد = سحب من الخزينة
        if (purchase) {
          await tx.purchase.update({
            where: { id: purchase.id },
            data: { paid: { increment: amountNumber } },
          })
        }
        await tx.treasuryTransaction.create({
          data: {
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
    // رسائل الأخطاء الصادرة من داخل الـ transaction بالعربية
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
