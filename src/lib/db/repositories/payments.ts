import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { dataChangeEmitter } from '../live-data'
import type { Payment, Sale, Purchase } from '../types'

class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    super('payments', true)
  }

  // سدادات عميل/مورد معين
  async getByParty(partyId: string): Promise<Payment[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('payments', 'by-party', partyId)
    return result.sort((a: Payment, b: Payment) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // السدادات في فترة محددة
  async getByDateRange(from?: string, to?: string): Promise<Payment[]> {
    const db = await this.getDB() as any
    let result: Payment[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('payments', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else if (from) {
      result = await db.getAllFromIndex('payments', 'by-date', IDBKeyRange.lowerBound(from))
    } else if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('payments', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
    } else {
      result = await this.getAll()
    }
    return result.sort((a: Payment, b: Payment) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // سدادات عملاء أو موردين
  async getByType(type: 'customer_payment' | 'supplier_payment'): Promise<Payment[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('payments', 'by-type', type)
    return result.sort((a: Payment, b: Payment) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // إنشاء سداد + إيداع/سحب من الخزينة تلقائياً + تحديث paid في الفاتورة
  async create(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const db = await getDB()
    const tx = db.transaction(
      ['payments', 'treasuryTransactions', 'sales', 'purchases'],
      'readwrite'
    )

    const now = nowISO()
    const paymentId = generateId()

    const payment: Payment = {
      ...data,
      id: paymentId,
      createdAt: now,
    }

    await tx.objectStore('payments').add(payment)

    // تحديث المدفوع في الفاتورة المرتبطة (لو موجودة)
    if (data.invoiceId) {
      if (data.type === 'customer_payment') {
        const sale = await tx.objectStore('sales').get(data.invoiceId) as Sale | undefined
        if (sale) {
          const updatedSale: Sale = {
            ...sale,
            paid: (sale.paid || 0) + data.amount,
            updatedAt: now,
          }
          await tx.objectStore('sales').put(updatedSale)
        }
      } else if (data.type === 'supplier_payment') {
        const purchase = await tx.objectStore('purchases').get(data.invoiceId) as Purchase | undefined
        if (purchase) {
          const updatedPurchase: Purchase = {
            ...purchase,
            paid: (purchase.paid || 0) + data.amount,
            updatedAt: now,
          }
          await tx.objectStore('purchases').put(updatedPurchase)
        }
      }
    }

    // إيداع أو سحب من الخزينة تلقائياً
    // سداد عميل = إيداع (فلوس دخلت)
    // سداد مورد = سحب (فلوس خرجت)
    const isCustomerPayment = data.type === 'customer_payment'
    const treasuryTx = {
      id: generateId(),
      type: isCustomerPayment ? 'deposit' as const : 'withdrawal' as const,
      amount: data.amount,
      date: data.date,
      description: isCustomerPayment
        ? `سداد من عميل - ${data.partyName}`
        : `سداد لمورد - ${data.partyName}`,
      category: isCustomerPayment ? 'مبيعات' : 'مشتريات',
      referenceType: 'payment',
      referenceId: paymentId,
      notes: data.invoiceNo
        ? `فاتورة رقم ${data.invoiceNo}${data.method ? ` - ${data.method}` : ''}`
        : data.method,
      createdAt: now,
    }
    await tx.objectStore('treasuryTransactions').add(treasuryTx)

    await tx.done

    // إشعار التحديث الفوري
    dataChangeEmitter.notifyCreate('payments')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (data.type === 'customer_payment') {
      dataChangeEmitter.notifyUpdate('sales')
      dataChangeEmitter.notifyUpdate('customers')
    } else {
      dataChangeEmitter.notifyUpdate('purchases')
      dataChangeEmitter.notifyUpdate('suppliers')
    }

    return payment
  }

  // حذف السداد + حذف معاملة الخزينة المرتبطة + تراجع عن تحديث الفاتورة
  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(
      ['payments', 'treasuryTransactions', 'sales', 'purchases'],
      'readwrite'
    )

    const payment = await tx.objectStore('payments').get(id) as Payment | undefined
    if (!payment) {
      await tx.done
      return
    }

    // تراجع عن تحديث paid في الفاتورة
    if (payment.invoiceId) {
      if (payment.type === 'customer_payment') {
        const sale = await tx.objectStore('sales').get(payment.invoiceId) as Sale | undefined
        if (sale) {
          await tx.objectStore('sales').put({
            ...sale,
            paid: Math.max(0, (sale.paid || 0) - payment.amount),
            updatedAt: nowISO(),
          })
        }
      } else if (payment.type === 'supplier_payment') {
        const purchase = await tx.objectStore('purchases').get(payment.invoiceId) as Purchase | undefined
        if (purchase) {
          await tx.objectStore('purchases').put({
            ...purchase,
            paid: Math.max(0, (purchase.paid || 0) - payment.amount),
            updatedAt: nowISO(),
          })
        }
      }
    }

    // حذف معاملة الخزينة المرتبطة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'payment' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    await tx.objectStore('payments').delete(id)
    await tx.done

    dataChangeEmitter.notifyDelete('payments')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (payment.type === 'customer_payment') {
      dataChangeEmitter.notifyUpdate('sales')
      dataChangeEmitter.notifyUpdate('customers')
    } else {
      dataChangeEmitter.notifyUpdate('purchases')
      dataChangeEmitter.notifyUpdate('suppliers')
    }
  }
}

export const paymentRepository = new PaymentRepository()
