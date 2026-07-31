import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { dataChangeEmitter } from '../live-data'
import type { PurchaseReturn, PurchaseReturnItem, Purchase, PurchaseItem } from '../types'

class PurchaseReturnRepository extends BaseRepository<PurchaseReturn> {
  constructor() {
    super('purchaseReturns', true)
  }

  // مرتجعات فاتورة مشتريات معينة
  async getByPurchase(purchaseId: string): Promise<PurchaseReturn[]> {
    const db = await this.getDB() as any
    const result = await db.getAllFromIndex('purchaseReturns', 'by-purchase', purchaseId)
    const withItems = await Promise.all(
      result.map(async (r: PurchaseReturn) => {
        const items = await db.getAllFromIndex('purchaseReturnItems', 'by-return', r.id)
        return { ...r, items }
      })
    )
    return withItems.sort((a: PurchaseReturn, b: PurchaseReturn) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  // المرتجعات في فترة محددة
  async getByDateRange(from?: string, to?: string): Promise<PurchaseReturn[]> {
    const db = await this.getDB() as any
    let result: PurchaseReturn[]
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('purchaseReturns', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
    } else if (from) {
      result = await db.getAllFromIndex('purchaseReturns', 'by-date', IDBKeyRange.lowerBound(from))
    } else if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      result = await db.getAllFromIndex('purchaseReturns', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
    } else {
      result = await this.getAll()
    }
    const withItems = await Promise.all(
      result.map(async (r: PurchaseReturn) => {
        const items = await db.getAllFromIndex('purchaseReturnItems', 'by-return', r.id)
        return { ...r, items }
      })
    )
    return withItems.sort((a: PurchaseReturn, b: PurchaseReturn) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }

  async getById(id: string): Promise<PurchaseReturn | undefined> {
    const purchaseReturn = await super.getById(id)
    if (!purchaseReturn) return undefined
    const db = await this.getDB() as any
    const items = await db.getAllFromIndex('purchaseReturnItems', 'by-return', id)
    return { ...purchaseReturn, items }
  }

  // توليد رقم مرتجع تسلسلي
  private async generateReturnNumber(): Promise<string> {
    const all = await this.getAll()
    const count = all.length + 1
    const year = new Date().getFullYear()
    return `PR-${year}-${String(count).padStart(4, '0')}`
  }

  // إنشاء مرتجع مشتريات + سحب الكميات من المخزون + إيداع في الخزينة (استرداد من المورد)
  // ملاحظة: سميناها createReturn بدلاً من create لأن نوع البيانات مختلف عن Partial<PurchaseReturn>
  // فلا يمكن عمل override متوافق مع الـ BaseRepository
  async createReturn(data: {
    purchaseId: string
    date: string
    reason?: string
    notes?: string
    items: Array<{
      purchaseItemId: string
      itemName: string
      materialId?: string
      quantity: number
      unitPrice: number
    }>
  }): Promise<PurchaseReturn> {
    const now = nowISO()
    const returnId = generateId()
    const returnNumber = await this.generateReturnNumber() // قبل بدء المعاملة

    const db = await getDB()
    const tx = db.transaction(
      ['purchaseReturns', 'purchaseReturnItems', 'purchases', 'materials', 'materialTransactions', 'treasuryTransactions'],
      'readwrite'
    )

    // جلب الفاتورة الأصلية
    const purchase = await tx.objectStore('purchases').get(data.purchaseId) as Purchase | undefined
    if (!purchase) {
      throw new Error('فاتورة المشتريات الأصلية غير موجودة')
    }

    // حساب الإجمالي
    const total = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

    const purchaseReturn: PurchaseReturn = {
      id: returnId,
      returnNumber,
      purchaseId: data.purchaseId,
      invoiceNo: purchase.invoiceNo,
      supplierName: purchase.supplierName,
      supplierId_ref: purchase.supplierId_ref,
      date: data.date,
      total,
      reason: data.reason,
      items: [],
      notes: data.notes,
      createdAt: now,
    }

    await tx.objectStore('purchaseReturns').add(purchaseReturn)

    // إضافة أصناف المرتجع + سحب الكميات من المخزون
    const returnItems: PurchaseReturnItem[] = []
    for (const it of data.items) {
      const item: PurchaseReturnItem = {
        id: generateId(),
        returnId,
        purchaseItemId: it.purchaseItemId,
        itemName: it.itemName,
        materialId: it.materialId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }
      await tx.objectStore('purchaseReturnItems').add(item)
      returnItems.push(item)

      // سحب الكميات من مواد المخزون (لو مربوطة بمادة)
      if (it.materialId) {
        const material = await tx.objectStore('materials').get(it.materialId)
        if (material) {
          const newQuantity = Math.max(0, material.quantity - it.quantity)
          await tx.objectStore('materials').put({
            ...material,
            quantity: newQuantity,
            updatedAt: now,
          })

          // تسجيل حركة سحب من المخزون
          const materialTx = {
            id: generateId(),
            materialId: it.materialId,
            warehouseId: material.warehouseId,
            type: 'out' as const,
            quantity: it.quantity,
            unitCost: it.unitPrice,
            date: data.date,
            reason: `مرتجع مشتريات - ${purchase.supplierName}`,
            referenceType: 'purchase_return',
            referenceId: returnId,
            notes: `مرتجع رقم ${returnNumber}`,
            createdAt: now,
          }
          await tx.objectStore('materialTransactions').add(materialTx)
        }
      }
    }

    // إيداع في الخزينة (استرداد المبلغ من المورد)
    if (total > 0) {
      const treasuryTx = {
        id: generateId(),
        type: 'deposit' as const,
        amount: total,
        date: data.date,
        description: `استرداد مرتجع مشتريات - ${purchase.supplierName}`,
        category: 'مشتريات',
        referenceType: 'purchase_return',
        referenceId: returnId,
        notes: `مرتجع رقم ${returnNumber}${purchase.invoiceNo ? ` - فاتورة ${purchase.invoiceNo}` : ''}`,
        createdAt: now,
      }
      await tx.objectStore('treasuryTransactions').add(treasuryTx)
    }

    await tx.done

    // إشعار التحديث الفوري
    dataChangeEmitter.notifyCreate('purchaseReturns')
    dataChangeEmitter.notifyCreate('purchaseReturnItems')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyUpdate('materialTransactions')

    return { ...purchaseReturn, items: returnItems }
  }

  // حذف مرتجع مشتريات + تراجع عن كل التأثيرات
  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(
      ['purchaseReturns', 'purchaseReturnItems', 'materials', 'materialTransactions', 'treasuryTransactions'],
      'readwrite'
    )

    const purchaseReturn = await tx.objectStore('purchaseReturns').get(id) as PurchaseReturn | undefined
    if (!purchaseReturn) {
      await tx.done
      return
    }

    const items = await tx.objectStore('purchaseReturnItems').index('by-return').getAll(id) as PurchaseReturnItem[]

    // إعادة الكميات للمواد (لأنها كانت مسحوبة)
    for (const item of items) {
      if (item.materialId) {
        const material = await tx.objectStore('materials').get(item.materialId)
        if (material) {
          await tx.objectStore('materials').put({
            ...material,
            quantity: material.quantity + item.quantity,
            updatedAt: nowISO(),
          })
        }
      }
    }

    // حذف حركات المواد المرتبطة
    const allMaterialTx = await tx.objectStore('materialTransactions').getAll()
    for (const t of allMaterialTx) {
      if (t.referenceType === 'purchase_return' && t.referenceId === id) {
        await tx.objectStore('materialTransactions').delete(t.id)
      }
    }

    // حذف معاملة الخزينة المرتبطة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'purchase_return' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    // حذف أصناف المرتجع
    const itemKeys = await tx.objectStore('purchaseReturnItems').index('by-return').getAllKeys(id)
    await Promise.all(itemKeys.map((k) => tx.objectStore('purchaseReturnItems').delete(k)))

    await tx.objectStore('purchaseReturns').delete(id)
    await tx.done

    dataChangeEmitter.notifyDelete('purchaseReturns')
    dataChangeEmitter.notifyDelete('purchaseReturnItems')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyUpdate('materialTransactions')
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository()
