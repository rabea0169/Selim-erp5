import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { productRepository } from './products'
import type { Sale, SaleItem } from '../types'

class SaleRepository extends BaseRepository<Sale> {
  constructor() {
    super('sales', true)
  }

  async search(query: string, from?: string, to?: string): Promise<Sale[]> {
    let sales = await this.getByDateRange(from, to)
    if (query) {
      const q = query.toLowerCase()
      sales = sales.filter(
        (s) =>
          s.customerName.toLowerCase().includes(q) ||
          (s.invoiceNo || '').toLowerCase().includes(q) ||
          (s.notes || '').toLowerCase().includes(q)
      )
    }
    return sales
  }

  async getByDateRange(from?: string, to?: string): Promise<Sale[]> {
    let sales: Sale[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        sales = await db.getAllFromIndex('sales', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        sales = await db.getAllFromIndex('sales', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        sales = await db.getAllFromIndex('sales', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      sales = await this.getAll()
    }

    // تحميل الأصناف لكل فاتورة
    const db = await this.getDB()
    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const items = await db.getAllFromIndex('saleItems', 'by-sale', sale.id)
        return { ...sale, items }
      })
    )

    return salesWithItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getById(id: string): Promise<Sale | undefined> {
    const sale = await super.getById(id)
    if (!sale) return undefined
    const db = await this.getDB()
    const items = await db.getAllFromIndex('saleItems', 'by-sale', id)
    return { ...sale, items }
  }

  async createWithItems(data: {
    customerName: string
    customerId_ref?: string
    invoiceNo?: string
    date: string
    paid: number
    notes?: string
    items: Array<{
      itemName: string
      productId?: string
      priceType?: 'wholesale' | 'half_wholesale' | 'retail' | 'custom'
      quantity: number
      unitPrice: number
    }>
  }): Promise<Sale> {
    const db = await this.getDB()
    const tx = db.transaction(['sales', 'saleItems', 'treasuryTransactions', 'products'], 'readwrite')

    const total = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const now = nowISO()
    const saleId = generateId()

    const sale: Sale = {
      id: saleId,
      customerName: data.customerName,
      customerId_ref: data.customerId_ref,
      invoiceNo: data.invoiceNo,
      date: data.date,
      total,
      paid: data.paid,
      notes: data.notes,
      items: [],
      createdAt: now,
      updatedAt: now,
    }

    await tx.objectStore('sales').add(sale)

    const items: SaleItem[] = []
    for (const it of data.items) {
      const item: SaleItem = {
        id: generateId(),
        saleId,
        itemName: it.itemName,
        productId: it.productId,
        priceType: it.priceType,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }
      await tx.objectStore('saleItems').add(item)
      items.push(item)

      // سحب الكمية من مخزون المنتج (لو مربوط بـ productId)
      if (it.productId) {
        const product = await tx.objectStore('products').get(it.productId)
        if (product) {
          if (product.quantity < it.quantity) {
            throw new Error(`الكمية المتاحة من ${product.name} (${product.quantity}) أقل من المطلوب (${it.quantity})`)
          }
          await tx.objectStore('products').put({
            ...product,
            quantity: product.quantity - it.quantity,
            updatedAt: now,
          })
        }
      }
    }

    // إيداع المبلغ المدفوع في الخزينة تلقائياً
    if (data.paid > 0) {
      const treasuryTx = {
        id: generateId(),
        type: 'deposit' as const,
        amount: data.paid,
        date: data.date,
        description: `تحصيل من مبيعة - ${data.customerName}`,
        category: 'مبيعات',
        referenceType: 'sale',
        referenceId: saleId,
        notes: data.invoiceNo ? `فاتورة رقم ${data.invoiceNo}` : undefined,
        createdAt: now,
      }
      await tx.objectStore('treasuryTransactions').add(treasuryTx)
    }

    await tx.done

    return { ...sale, items }
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(['sales', 'saleItems', 'treasuryTransactions', 'products'], 'readwrite')

    // حذف المعاملات المرتبطة في الخزينة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'sale' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    // إرجاع الكميات للمنتجات (لو مربوطة بـ productId)
    const items = await tx.objectStore('saleItems').index('by-sale').getAll(id)
    for (const item of items) {
      if (item.productId) {
        const product = await tx.objectStore('products').get(item.productId)
        if (product) {
          await tx.objectStore('products').put({
            ...product,
            quantity: product.quantity + item.quantity,
            updatedAt: nowISO(),
          })
        }
      }
    }

    // حذف الأصناف أولاً
    const itemKeys = await tx.objectStore('saleItems').index('by-sale').getAllKeys(id)
    await Promise.all(itemKeys.map((k) => tx.objectStore('saleItems').delete(k)))

    // حذف الفاتورة
    await tx.objectStore('sales').delete(id)

    await tx.done
  }
}

export const saleRepository = new SaleRepository()
