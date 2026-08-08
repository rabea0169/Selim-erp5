import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { safeError } from '@/lib/safe-error'

// GET /api/payments
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const partyId = searchParams.get('partyId')
    const invoiceId = searchParams.get('invoiceId')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))

    const where: any = user?.companyId ? { companyId: user.companyId } : {}
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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const companyId = user.companyId || null
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
    const amountNumber = Math.round(Number(amount) * 100) / 100
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: 'المبلغ يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // تنفيذ العملية في transaction واحد
    const payment = await db.$transaction(async (tx) => {
      let sale: any = null
      let purchase: any = null

      if (invoiceId?.trim()) {
        if (type === 'customer_payment') {
          sale = await tx.sale.findFirst({
            where: { id: invoiceId.trim(), ...(companyId ? { companyId } : {}) },
          })
          if (!sale) {
            throw new Error('فاتورة البيع المحددة غير موجودة')
          }
          // الدقة العشرية ومقارنة الرصيد المتبقي بمقياس محدد لتجنب أخطاء عواشر جافاسكريبت
          const remaining = Math.round((sale.total - sale.paid) * 100) / 100
          if (amountNumber - remaining > 0.01) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining})`)
          }
        } else {
          purchase = await tx.purchase.findFirst({
            where: { id: invoiceId.trim(), ...(companyId ? { companyId } : {}) },
          })
          if (!purchase) {
            throw new Error('فاتورة الشراء المحددة غير موجودة')
          }
          const remaining = Math.round((purchase.total - purchase.paid) * 100) / 100
          if (amountNumber - remaining > 0.01) {
            throw new Error(`المبلغ (${amountNumber}) يتجاوز الرصيد المتبقي للفاتورة (${remaining})`)
          }
        }
      }

      // إنشاء سجل السداد مع ربط companyId
      const newPayment = await tx.payment.create({
        data: {
          companyId,
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

      // تحديث الفاتورة وإنشاء حركة خزينة مع ربط companyId
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
            companyId,
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
  } catch (e: any) {
    const { error, status } = safeError(e, 400)
    return NextResponse.json({ error }, { status })
  }
}
