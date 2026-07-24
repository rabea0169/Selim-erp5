import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { materialRepository } from './warehouses'
import type { Purchase, PurchaseItem } from '../types'

class PurchaseRepository extends BaseRepository<Purchase> {
  constructor() {
    super('purchases', true)
  }

  async search(query: string, from?: string, to?: string): Promise<Purchase[]> {
    let purchases = await this.getByDateRange(from, to)
    if (query) {
      const q = query.toLowerCase()
      purchases = purchases.filter(
        (p) =>
          p.supplierName.toLowerCase().includes(q) ||
          (p.invoiceNo || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q)
      )
    }
    return purchases
  }

  async getByDateRange(from?: string, to?: string): Promise<Purchase[]> {
    let purchases: Purchase[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        purchases = await db.getAllFromIndex('purchases', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        purchases = await db.getAllFromIndex('purchases', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        purchases = await db.getAllFromIndex('purchases', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      purchases = await this.getAll()
    }

    // تحميل الأصناف لكل فاتورة
    const db = await this.getDB()
    const purchasesWithItems = await Promise.all(
      purchases.map(async (purchase) => {
        const items = await db.getAllFromIndex('purchaseItems', 'by-purchase', purchase.id)
        return { ...purchase, items }
      })
    )

    return purchasesWithItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getById(id: string): Promise<Purchase | undefined> {
    const purchase = await super.getById(id)
    if (!purchase) return undefined
    const db = await this.getDB()
    const items = await db.getAllFromIndex('purchaseItems', 'by-purchase', id)
    return { ...purchase, items }
  }

  async createWithItems(data: {
    supplierName: string
    supplierId_ref?: string
    invoiceNo?: string
    date: string
    paid: number
    notes?: string
    items: Array<{
      itemName: string
      materialId?: string
      quantity: number
      unitPrice: number
    }>
  }): Promise<Purchase> {
    const db = await this.getDB()
    const tx = db.transaction(['purchases', 'purchaseItems', 'treasuryTransactions'], 'readwrite')

    const total = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)
    const now = nowISO()
    const purchaseId = generateId()

    const purchase: Purchase = {
      id: purchaseId,
      supplierName: data.supplierName,
      supplierId_ref: data.supplierId_ref,
      invoiceNo: data.invoiceNo,
      date: data.date,
      total,
      paid: data.paid,
      notes: data.notes,
      items: [],
      createdAt: now,
      updatedAt: now,
    }

    await tx.objectStore('purchases').add(purchase)

    const items: PurchaseItem[] = []
    for (const it of data.items) {
      const item: PurchaseItem = {
        id: generateId(),
        purchaseId,
        itemName: it.itemName,
        materialId: it.materialId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }
      await tx.objectStore('purchaseItems').add(item)
      items.push(item)
    }

    // سحب المبلغ المدفوع من الخزينة تلقائياً
    if (data.paid > 0) {
      const treasuryTx = {
        id: generateId(),
        type: 'withdrawal' as const,
        amount: data.paid,
        date: data.date,
        description: `دفع لمورد - ${data.supplierName}`,
        category: 'مشتريات',
        referenceType: 'purchase',
        referenceId: purchaseId,
        notes: data.invoiceNo ? `فاتورة رقم ${data.invoiceNo}` : undefined,
        createdAt: now,
      }
      await tx.objectStore('treasuryTransactions').add(treasuryTx)
    }

    await tx.done

    // إضافة الكميات للمواد الخام المرتبطة (خارج المعاملة لتجنب تعارض object stores)
    for (const it of data.items) {
      if (it.materialId) {
        try {
          await materialRepository.addStock(
            it.materialId,
            it.quantity,
            it.unitPrice,
            `شراء - ${data.supplierName}${data.invoiceNo ? ` (فاتورة ${data.invoiceNo})` : ''}`,
            `من فاتورة مشتريات ${purchaseId}`
          )
        } catch (e) {
          // لو المادة محذوفة - تجاهل
          console.warn('Could not add stock to material', it.materialId, e)
        }
      }
    }

    return { ...purchase, items }
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(['purchases', 'purchaseItems', 'treasuryTransactions'], 'readwrite')

    // حذف المعاملات المرتبطة في الخزينة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'purchase' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    const itemKeys = await tx.objectStore('purchaseItems').index('by-purchase').getAllKeys(id)
    await Promise.all(itemKeys.map((k) => tx.objectStore('purchaseItems').delete(k)))

    await tx.objectStore('purchases').delete(id)

    await tx.done
  }
}

export const purchaseRepository = new PurchaseRepository()
