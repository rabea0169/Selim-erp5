import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
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
    discountType?: 'percentage' | 'fixed'
    discountValue?: number
    taxRate?: number
    extraFees?: number
    items: Array<{
      itemName: string
      materialId?: string
      quantity: number
      unitPrice: number
    }>
  }): Promise<Purchase> {
    const db = await this.getDB()
    const tx = db.transaction(['purchases', 'purchaseItems', 'treasuryTransactions', 'materials', 'materialTransactions'], 'readwrite')

    // حساب الإجمالي الفرعي
    const subtotal = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

    // حساب مبلغ الخصم
    let discountAmount = 0
    if (data.discountType && data.discountValue && data.discountValue > 0) {
      if (data.discountType === 'percentage') {
        discountAmount = (subtotal * data.discountValue) / 100
      } else {
        discountAmount = Math.min(data.discountValue, subtotal)
      }
    }

    // حساب الضريبة
    const taxRate = data.taxRate || 0
    const taxableBase = subtotal - discountAmount
    const taxAmount = taxRate > 0 ? (taxableBase * taxRate) / 100 : 0

    // مصاريف إضافية
    const extraFees = data.extraFees || 0

    // الإجمالي النهائي
    const total = subtotal - discountAmount + taxAmount + extraFees

    const now = nowISO()
    const purchaseId = generateId()

    const purchase: Purchase = {
      id: purchaseId,
      supplierName: data.supplierName,
      supplierId_ref: data.supplierId_ref,
      invoiceNo: data.invoiceNo,
      date: data.date,
      subtotal,
      discountType: data.discountType,
      discountValue: data.discountValue,
      discountAmount,
      taxRate,
      taxAmount,
      extraFees,
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

    // إضافة الكميات للمواد الخام المرتبطة داخل نفس المعاملة
    for (const it of data.items) {
      if (it.materialId) {
        try {
          const material = await tx.objectStore('materials').get(it.materialId)
          if (material) {
            const totalOldValue = material.quantity * material.unitCost
            const totalNewValue = it.quantity * it.unitPrice
            const newQuantity = material.quantity + it.quantity
            const newUnitCost = newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : it.unitPrice

            await tx.objectStore('materials').put({
              ...material,
              quantity: newQuantity,
              unitCost: newUnitCost,
              updatedAt: now,
            })

            const matTx = {
              id: generateId(),
              materialId: it.materialId,
              warehouseId: material.warehouseId,
              type: 'in' as const,
              quantity: it.quantity,
              unitCost: it.unitPrice,
              date: now,
              reason: `شراء - ${data.supplierName}${data.invoiceNo ? ` (فاتورة ${data.invoiceNo})` : ''}`,
              referenceType: 'purchase',
              referenceId: purchaseId,
              notes: `من فاتورة مشتريات ${purchaseId}`,
              createdAt: now,
            }
            await tx.objectStore('materialTransactions').add(matTx)
          }
        } catch (e) {
          // لو المادة محذوفة - تجاهل
          console.warn('Could not add stock to material', it.materialId, e)
        }
      }
    }

    await tx.done

    return { ...purchase, items }
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(['purchases', 'purchaseItems', 'treasuryTransactions', 'materials', 'materialTransactions'], 'readwrite')

    // حذف المعاملات المرتبطة في الخزينة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'purchase' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    // تراجع عن إضافة الكميات للمواد الخام + حذف حركات المواد المرتبطة
    const itemKeys = await tx.objectStore('purchaseItems').index('by-purchase').getAllKeys(id)
    for (const k of itemKeys) {
      const item = await tx.objectStore('purchaseItems').get(k)
      if (item && item.materialId) {
        try {
          const material = await tx.objectStore('materials').get(item.materialId)
          if (material) {
            const newQuantity = Math.max(0, material.quantity - item.quantity)
            await tx.objectStore('materials').put({
              ...material,
              quantity: newQuantity,
              updatedAt: nowISO(),
            })
          }
        } catch (e) {
          console.warn('Could not reverse material stock on purchase delete:', e)
        }
      }
      await tx.objectStore('purchaseItems').delete(k)
    }

    // حذف حركات المواد المرتبطة بهذه المشتريات
    const allMatTx = await tx.objectStore('materialTransactions').getAll()
    for (const t of allMatTx) {
      if (t.referenceType === 'purchase' && t.referenceId === id) {
        await tx.objectStore('materialTransactions').delete(t.id)
      }
    }

    await tx.objectStore('purchases').delete(id)

    await tx.done
  }
}

export const purchaseRepository = new PurchaseRepository()
