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

    // استخدام transaction لضمان إتمام العملية بالكامل أو فشلها بالكامل
    await db.$transaction(async (tx) => {
      // حذف كل البيانات الحالية بالترتيب الصحيح (للعلاقات)
      await tx.expense.deleteMany()
      await tx.expenseCategory.deleteMany()
      await tx.purchaseItem.deleteMany()
      await tx.purchase.deleteMany()
      await tx.saleItem.deleteMany()
      await tx.sale.deleteMany()
      await tx.supplier.deleteMany()
      await tx.customer.deleteMany()
      await tx.production.deleteMany()
      await tx.workerAttendance.deleteMany()
      await tx.workerReceipt.deleteMany()
      await tx.workerAdvance.deleteMany()
      await tx.worker.deleteMany()

      // إعادة إنشاء البيانات بالترتيب الصحيح (الأصول قبل الأبناء)
      // 1. فئات المصاريف
      if (data.expenseCategories?.length) {
        for (const c of data.expenseCategories) {
          await tx.expenseCategory.create({
            data: {
              id: c.id,
              name: c.name,
              notes: c.notes ?? null,
              createdAt: new Date(c.createdAt),
            },
          })
        }
      }
      // 2. المصاريف (تعتمد على فئات المصاريف)
      if (data.expenses?.length) {
        for (const e of data.expenses) {
          await tx.expense.create({
            data: {
              id: e.id,
              categoryId: e.categoryId,
              categoryName: e.categoryName,
              amount: Number(e.amount),
              date: new Date(e.date),
              notes: e.notes ?? null,
              createdAt: new Date(e.createdAt),
            },
          })
        }
      }
      // 3. العمال
      if (data.workers?.length) {
        for (const w of data.workers) {
          await tx.worker.create({
            data: {
              id: w.id,
              name: w.name,
              phone: w.phone ?? null,
              job: w.job ?? null,
              type: w.type || 'monthly',
              notes: w.notes ?? null,
              createdAt: new Date(w.createdAt),
              updatedAt: new Date(w.updatedAt),
            },
          })
        }
      }
      // 4. سلف/قبض/حضور/إنتاج العمال (تعتمد على العمال)
      if (data.workerAdvances?.length) {
        for (const a of data.workerAdvances) {
          await tx.workerAdvance.create({
            data: {
              id: a.id,
              workerId: a.workerId,
              amount: Number(a.amount),
              date: new Date(a.date),
              notes: a.notes ?? null,
              createdAt: new Date(a.createdAt),
            },
          })
        }
      }
      if (data.workerReceipts?.length) {
        for (const r of data.workerReceipts) {
          await tx.workerReceipt.create({
            data: {
              id: r.id,
              workerId: r.workerId,
              amount: Number(r.amount),
              date: new Date(r.date),
              notes: r.notes ?? null,
              createdAt: new Date(r.createdAt),
            },
          })
        }
      }
      if (data.workerAttendance?.length) {
        for (const a of data.workerAttendance) {
          await tx.workerAttendance.create({
            data: {
              id: a.id,
              workerId: a.workerId,
              date: new Date(a.date),
              checkIn: a.checkIn ? new Date(a.checkIn) : null,
              checkOut: a.checkOut ? new Date(a.checkOut) : null,
              status: a.status || 'present',
              notes: a.notes ?? null,
              createdAt: new Date(a.createdAt),
            },
          })
        }
      }
      if (data.production?.length) {
        for (const p of data.production) {
          await tx.production.create({
            data: {
              id: p.id,
              workerId: p.workerId,
              date: new Date(p.date),
              modelName: p.modelName,
              quantity: Number(p.quantity),
              unitPrice: Number(p.unitPrice),
              total: Number(p.total),
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
            },
          })
        }
      }
      // 5. العملاء والموردين
      if (data.customers?.length) {
        for (const c of data.customers) {
          await tx.customer.create({
            data: {
              id: c.id,
              name: c.name,
              phone: c.phone ?? null,
              address: c.address ?? null,
              notes: c.notes ?? null,
              createdAt: new Date(c.createdAt),
            },
          })
        }
      }
      if (data.suppliers?.length) {
        for (const s of data.suppliers) {
          await tx.supplier.create({
            data: {
              id: s.id,
              name: s.name,
              phone: s.phone ?? null,
              address: s.address ?? null,
              notes: s.notes ?? null,
              createdAt: new Date(s.createdAt),
            },
          })
        }
      }
      // 6. المبيعات وأصنافها (تعتمد على العملاء)
      if (data.sales?.length) {
        for (const s of data.sales) {
          await tx.sale.create({
            data: {
              id: s.id,
              invoiceNo: s.invoiceNo ?? null,
              customerName: s.customerName,
              customerId_ref: s.customerId_ref || null,
              date: new Date(s.date),
              total: Number(s.total),
              paid: Number(s.paid),
              notes: s.notes ?? null,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
            },
          })
        }
      }
      if (data.saleItems?.length) {
        for (const it of data.saleItems) {
          await tx.saleItem.create({
            data: {
              id: it.id,
              saleId: it.saleId,
              itemName: it.itemName,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.total),
            },
          })
        }
      }
      // 7. المشتريات وأصنافها (تعتمد على الموردين)
      if (data.purchases?.length) {
        for (const p of data.purchases) {
          await tx.purchase.create({
            data: {
              id: p.id,
              invoiceNo: p.invoiceNo ?? null,
              supplierName: p.supplierName,
              supplierId_ref: p.supplierId_ref || null,
              date: new Date(p.date),
              total: Number(p.total),
              paid: Number(p.paid),
              notes: p.notes ?? null,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
            },
          })
        }
      }
      if (data.purchaseItems?.length) {
        for (const it of data.purchaseItems) {
          await tx.purchaseItem.create({
            data: {
              id: it.id,
              purchaseId: it.purchaseId,
              itemName: it.itemName,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              total: Number(it.total),
            },
          })
        }
      }
    })

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
