import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { dataChangeEmitter } from '../live-data'
import type { SaleReturn, SaleReturnItem, Sale, SaleItem } from '../types'

class SaleReturnRepository extends BaseRepository<SaleReturn> {
  constructor() {
    super('saleReturns', true)
  }

  // مرتجعات فاتورة معينة
  async getBySale(saleId: string): Promise<SaleReturn[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('saleReturns', 'by-sale', saleId)
    const withItems = await Promise.all(
      result.map(async (r: SaleReturn) => {
        const items = await db.getAllFromIndex('saleReturnItems', 'by-return', r.id)
        return { ...r, items }
      })
    )
    return withItems.sort((a: SaleReturn, b: SaleReturn) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // المرتجعات في فترة محددة
  async getByDateRange(from?: string, to?: string): Promise<SaleReturn[]> {
    const db = await this.getDB() as any
    let result: SaleReturn[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('saleReturns', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else if (from) {
      result = await db.getAllFromIndex('saleReturns', 'by-date', IDBKeyRange.lowerBound(from))
    } else if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('saleReturns', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
    } else {
      result = await this.getAll()
    }
    const withItems = await Promise.all(
      result.map(async (r: SaleReturn) => {
        const items = await db.getAllFromIndex('saleReturnItems', 'by-return', r.id)
        return { ...r, items }
      })
    )
    return withItems.sort((a: SaleReturn, b: SaleReturn) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  async getById(id: string): Promise<SaleReturn | undefined> {
    const saleReturn = await super.getById(id)
    if (!saleReturn) return undefined
    const db = await this.getDB() as any
    const items = await db.getAllFromIndex('saleReturnItems', 'by-return', id)
    return { ...saleReturn, items }
  }

  // توليد رقم مرتجع تسلسلي
  private async generateReturnNumber(): Promise<string> {
    const all = await this.getAll()
    const count = all.length + 1
    const year = new Date().getFullYear()
    return `SR-${year}-${String(count).padStart(4, '0')}`
  }

  // إنشاء مرتجع مبيعات + إرجاع الكميات للمخزون + سحب من الخزينة (استرداد المبلغ)
  // ملاحظة: سميناها createReturn بدلاً من create لأن نوع البيانات مختلف عن Partial<SaleReturn>
  // فلا يمكن عمل override متوافق مع الـ BaseRepository
  async createReturn(data: {
    saleId: string
    date: string
    reason?: string
    restockItems: boolean
    notes?: string
    items: Array<{
      saleItemId: string
      itemName: string
      productId?: string
      quantity: number
      unitPrice: number
    }>
  }): Promise<SaleReturn> {
    const db = await getDB()
    const tx = db.transaction(
      ['saleReturns', 'saleReturnItems', 'sales', 'products', 'treasuryTransactions'],
      'readwrite'
    )

    const now = nowISO()
    const returnId = generateId()
    const returnNumber = await this.generateReturnNumber()

    // جلب الفاتورة الأصلية
    const sale = await tx.objectStore('sales').get(data.saleId) as Sale | undefined
    if (!sale) {
      throw new Error('الفاتورة الأصلية غير موجودة')
    }

    // حساب الإجمالي
    const total = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

    const saleReturn: SaleReturn = {
      id: returnId,
      returnNumber,
      saleId: data.saleId,
      invoiceNo: sale.invoiceNo,
      customerName: sale.customerName,
      customerId_ref: sale.customerId_ref,
      date: data.date,
      total,
      reason: data.reason,
      restockItems: data.restockItems,
      items: [],
      notes: data.notes,
      createdAt: now,
    }

    await tx.objectStore('saleReturns').add(saleReturn)

    // إضافة أصناف المرتجع + إرجاع الكميات للمخزون
    const returnItems: SaleReturnItem[] = []
    for (const it of data.items) {
      const item: SaleReturnItem = {
        id: generateId(),
        returnId,
        saleItemId: it.saleItemId,
        itemName: it.itemName,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }
      await tx.objectStore('saleReturnItems').add(item)
      returnItems.push(item)

      // إرجاع الكميات لمنتجات المخزون (لو restockItems = true)
      if (data.restockItems && it.productId) {
        const product = await tx.objectStore('products').get(it.productId)
        if (product) {
          await tx.objectStore('products').put({
            ...product,
            quantity: product.quantity + it.quantity,
            updatedAt: now,
          })
        }
      }
    }

    // سحب من الخزينة (استرداد المبلغ للعميل)
    if (total > 0) {
      const treasuryTx = {
        id: generateId(),
        type: 'withdrawal' as const,
        amount: total,
        date: data.date,
        description: `استرداد مرتجع مبيعات - ${sale.customerName}`,
        category: 'مبيعات',
        referenceType: 'sale_return',
        referenceId: returnId,
        notes: `مرتجع رقم ${returnNumber}${sale.invoiceNo ? ` - فاتورة ${sale.invoiceNo}` : ''}`,
        createdAt: now,
      }
      await tx.objectStore('treasuryTransactions').add(treasuryTx)
    }

    await tx.done

    // إشعار التحديث الفوري
    dataChangeEmitter.notifyCreate('saleReturns')
    dataChangeEmitter.notifyCreate('saleReturnItems')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (data.restockItems) {
      dataChangeEmitter.notifyUpdate('products')
    }

    return { ...saleReturn, items: returnItems }
  }

  // حذف مرتجع + تراجع عن كل التأثيرات
  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(
      ['saleReturns', 'saleReturnItems', 'products', 'treasuryTransactions'],
      'readwrite'
    )

    const saleReturn = await tx.objectStore('saleReturns').get(id) as SaleReturn | undefined
    if (!saleReturn) {
      await tx.done
      return
    }

    const items = await tx.objectStore('saleReturnItems').index('by-return').getAll(id) as SaleReturnItem[]

    // لو كان قد أعاد الكميات للمخزون، نسحبها تاني
    if (saleReturn.restockItems) {
      for (const item of items) {
        if (item.productId) {
          const product = await tx.objectStore('products').get(item.productId)
          if (product) {
            await tx.objectStore('products').put({
              ...product,
              quantity: Math.max(0, product.quantity - item.quantity),
              updatedAt: nowISO(),
            })
          }
        }
      }
    }

    // حذف معاملة الخزينة المرتبطة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'sale_return' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    // حذف أصناف المرتجع
    const itemKeys = await tx.objectStore('saleReturnItems').index('by-return').getAllKeys(id)
    await Promise.all(itemKeys.map((k) => tx.objectStore('saleReturnItems').delete(k)))

    await tx.objectStore('saleReturns').delete(id)
    await tx.done

    dataChangeEmitter.notifyDelete('saleReturns')
    dataChangeEmitter.notifyDelete('saleReturnItems')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (saleReturn.restockItems) {
      dataChangeEmitter.notifyUpdate('products')
    }
  }
}

export const saleReturnRepository = new SaleReturnRepository()
