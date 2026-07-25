import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireAuth } from '@/lib/require-auth'
import { withCompanyScope } from '@/lib/permissions'
import { isSupplierPayment, toPartyColumns, withPartyId } from '@/lib/payment-party'

// GET /api/payments?from=&to=&type=&partyId=
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth('read')
    if (!auth.authorized) return auth.response

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const type = searchParams.get('type')
    const partyId = searchParams.get('partyId')

    const where: any = withCompanyScope({}, auth.companyId)
    if (type) where.type = type
    if (partyId) where.OR = [{ customerId: partyId }, { supplierId: partyId }]
    if (from || to) {
      where.date = {}
      if (from) where.date.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }

    const payments = await db.payment.findMany({ where, orderBy: { date: 'desc' } })
    return NextResponse.json({ payments: payments.map(withPartyId) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/payments
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth('create')
    if (!auth.authorized) return auth.response

    const body = await req.json()
    const { type, partyId, partyName, invoiceId, invoiceNo, amount, date, method, notes } = body

    if (!type?.trim()) {
      return NextResponse.json({ error: 'نوع السداد مطلوب' }, { status: 400 })
    }
    if (!partyId?.trim()) {
      return NextResponse.json({ error: 'العميل أو المورد مطلوب' }, { status: 400 })
    }
    const amountNum = Number(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'المبلغ يجب أن يكون رقماً موجباً' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'التاريخ مطلوب' }, { status: 400 })
    }

    const isSupplier = isSupplierPayment(type)
    const party = isSupplier
      ? await db.supplier.findFirst({ where: { id: partyId, companyId: auth.companyId } })
      : await db.customer.findFirst({ where: { id: partyId, companyId: auth.companyId } })
    if (!party) {
      return NextResponse.json({ error: isSupplier ? 'المورد غير موجود' : 'العميل غير موجود' }, { status: 404 })
    }

    const payment = await db.payment.create({
      data: {
        type: type.trim(),
        ...toPartyColumns(type, partyId),
        partyName: partyName?.trim() || party.name,
        invoiceId: invoiceId || null,
        invoiceNo: invoiceNo?.trim() || null,
        amount: amountNum,
        date: new Date(date),
        method: method?.trim() || null,
        notes: notes?.trim() || null,
        companyId: auth.companyId,
      },
    })

    return NextResponse.json({ payment: withPartyId(payment) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
