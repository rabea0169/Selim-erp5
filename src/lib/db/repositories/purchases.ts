import { BaseRepository } from './base'
import type { Purchase } from '../types'

class PurchaseRepository extends BaseRepository<Purchase> {
  constructor() {
    super('purchases')
  }

  async search(query?: string, from?: string, to?: string): Promise<Purchase[]> {
    return super.search(query, from, to)
  }

  async getByDateRange(from?: string, to?: string): Promise<Purchase[]> {
    return this.search(undefined, from, to)
  }

  async createWithItems(data: {
    supplierName: string
    supplierId_ref?: string
    invoiceNo?: string
    date: string
    paid: number
    notes?: string
    discountType?: string
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
    const subtotal = data.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

    let discountAmount = 0
    if (data.discountType && data.discountValue && data.discountValue > 0) {
      if (data.discountType === 'percentage') {
        discountAmount = (subtotal * data.discountValue) / 100
      } else {
        discountAmount = Math.min(data.discountValue, subtotal)
      }
    }

    const taxRate = data.taxRate || 0
    const taxableBase = subtotal - discountAmount
    const taxAmount = taxRate > 0 ? (taxableBase * taxRate) / 100 : 0
    const extraFees = data.extraFees || 0
    const total = subtotal - discountAmount + taxAmount + extraFees

    const payload = {
      supplierName: data.supplierName,
      supplierId_ref: data.supplierId_ref,
      invoiceNo: data.invoiceNo,
      date: data.date,
      paid: data.paid,
      notes: data.notes,
      total,
      items: data.items.map((it) => ({
        itemName: it.itemName,
        materialId: it.materialId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      })),
    }

    return this.create(payload as any)
  }

  async delete(id: string): Promise<void> {
    await super.delete(id)
  }
}

export const purchaseRepository = new PurchaseRepository()