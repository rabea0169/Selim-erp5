import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/restore - استرجاع البيانات من ملف JSON
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: 'بيانات النسخة الاحتياطية غير صحيحة' }, { status: 400 })
    }

    // حذف كل البيانات الحالية بالترتيب الصحيح (للعلاقات)
    await db.expense.deleteMany()
    await db.expenseCategory.deleteMany()
    await db.purchaseItem.deleteMany()
    await db.purchase.deleteMany()
    await db.saleItem.deleteMany()
    await db.sale.deleteMany()
    await db.supplier.deleteMany()
    await db.customer.deleteMany()
    await db.production.deleteMany()
    await db.workerAttendance.deleteMany()
    await db.workerReceipt.deleteMany()
    await db.workerAdvance.deleteMany()
    await db.worker.deleteMany()

    // إعادة إنشاء البيانات بالترتيب الصحيح
    if (data.expenseCategories?.length) {
      for (const c of data.expenseCategories) {
        await db.expenseCategory.create({ data: { id: c.id, name: c.name, notes: c.notes, createdAt: new Date(c.createdAt) } })
      }
    }
    if (data.expenses?.length) {
      for (const e of data.expenses) {
        await db.expense.create({ data: { id: e.id, categoryId: e.categoryId, categoryName: e.categoryName, amount: e.amount, date: new Date(e.date), notes: e.notes, createdAt: new Date(e.createdAt) } })
      }
    }
    if (data.workers?.length) {
      for (const w of data.workers) {
        await db.worker.create({ data: { id: w.id, name: w.name, phone: w.phone, job: w.job, type: w.type || 'monthly', notes: w.notes, createdAt: new Date(w.createdAt), updatedAt: new Date(w.updatedAt) } })
      }
    }
    if (data.workerAdvances?.length) {
      for (const a of data.workerAdvances) {
        await db.workerAdvance.create({ data: { id: a.id, workerId: a.workerId, amount: a.amount, date: new Date(a.date), notes: a.notes, createdAt: new Date(a.createdAt) } })
      }
    }
    if (data.workerReceipts?.length) {
      for (const r of data.workerReceipts) {
        await db.workerReceipt.create({ data: { id: r.id, workerId: r.workerId, amount: r.amount, date: new Date(r.date), notes: r.notes, createdAt: new Date(r.createdAt) } })
      }
    }
    if (data.workerAttendance?.length) {
      for (const a of data.workerAttendance) {
        await db.workerAttendance.create({ data: { id: a.id, workerId: a.workerId, date: new Date(a.date), checkIn: a.checkIn ? new Date(a.checkIn) : null, checkOut: a.checkOut ? new Date(a.checkOut) : null, status: a.status, notes: a.notes, createdAt: new Date(a.createdAt) } })
      }
    }
    if (data.production?.length) {
      for (const p of data.production) {
        await db.production.create({ data: { id: p.id, workerId: p.workerId, date: new Date(p.date), modelName: p.modelName, quantity: p.quantity, unitPrice: p.unitPrice, total: p.total, notes: p.notes, createdAt: new Date(p.createdAt) } })
      }
    }
    if (data.customers?.length) {
      for (const c of data.customers) {
        await db.customer.create({ data: { id: c.id, name: c.name, phone: c.phone, address: c.address, notes: c.notes, createdAt: new Date(c.createdAt) } })
      }
    }
    if (data.suppliers?.length) {
      for (const s of data.suppliers) {
        await db.supplier.create({ data: { id: s.id, name: s.name, phone: s.phone, address: s.address, notes: s.notes, createdAt: new Date(s.createdAt) } })
      }
    }
    if (data.sales?.length) {
      for (const s of data.sales) {
        await db.sale.create({ data: { id: s.id, invoiceNo: s.invoiceNo, customerId: s.customerId, customerName: s.customerName, customerId_ref: s.customerId_ref || null, date: new Date(s.date), total: s.total, paid: s.paid, notes: s.notes, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) } })
      }
    }
    if (data.saleItems?.length) {
      for (const it of data.saleItems) {
        await db.saleItem.create({ data: { id: it.id, saleId: it.saleId, itemName: it.itemName, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total } })
      }
    }
    if (data.purchases?.length) {
      for (const p of data.purchases) {
        await db.purchase.create({ data: { id: p.id, invoiceNo: p.invoiceNo, supplierName: p.supplierName, supplierId_ref: p.supplierId_ref || null, date: new Date(p.date), total: p.total, paid: p.paid, notes: p.notes, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) } })
      }
    }
    if (data.purchaseItems?.length) {
      for (const it of data.purchaseItems) {
        await db.purchaseItem.create({ data: { id: it.id, purchaseId: it.purchaseId, itemName: it.itemName, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total } })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم استرجاع البيانات بنجاح',
      counts: {
        workers: data.workers?.length || 0,
        customers: data.customers?.length || 0,
        suppliers: data.suppliers?.length || 0,
        sales: data.sales?.length || 0,
        purchases: data.purchases?.length || 0,
        expenses: data.expenses?.length || 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
