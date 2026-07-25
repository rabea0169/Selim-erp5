import { BaseRepository } from './base'
import type { Sale } from '../types'

class SaleRepository extends BaseRepository<Sale> {
  constructor() {
    super('sales')
  }

  async search(query?: string, from?: string, to?: string): Promise<Sale[]> {
    return super.search(query, from, to)
  }

  async getByDateRange(from?: string, to?: string): Promise<Sale[]> {
    return this.search(undefined, from, to)
  }

  // إنشاء فاتورة مع الأصناف عبر API (السيرفر يتعامل مع كل شيء)
  async createWithItems(data: {
    customerName: string
    customerId_ref?: string
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
      productId?: string
      priceType?: string
      quantity: number
      unitPrice: number
    }>
  }): Promise<Sale> {
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
      customerName: data.customerName,
      customerId_ref: data.customerId_ref,
      invoiceNo: data.invoiceNo,
      date: data.date,
      paid: data.paid,
      notes: data.notes,
      total,
      items: data.items.map((it) => ({
        itemName: it.itemName,
        productId: it.productId,
        priceType: it.priceType,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      })),
    }

    return this.create(payload as any)
  }

  // حذف الفاتورة عبر API (السيرفر يتعامل مع cascade)
  async delete(id: string): Promise<void> {
    await super.delete(id)
  }
}

export const saleRepository = new SaleRepository()