'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Sale } from '../types'

interface SalePayload {
  customerName: string
  customerId_ref?: string
  invoiceNo?: string
  date: string
  paid: number
  notes?: string
  discountType?: 'percentage' | 'fixed'
  discountValue?: number
  taxRate?: number
  extraFees?: number
  items: Array<{ itemName: string; productId?: string; priceType?: string; quantity: number; unitPrice: number }>
}

class SaleRepository extends BaseRepository<Sale> {
  constructor() { super('/api/sales', 'sales', 'sales') }

  async search(query: string, from?: string, to?: string): Promise<Sale[]> {
    const params: Record<string, string> = {}
    if (query) params.q = query
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getByDateRange(from?: string, to?: string): Promise<Sale[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getById(id: string): Promise<Sale | undefined> {
    try {
      const res = await apiGet<any>(`/api/sales/${id}`)
      return res.sale || res
    } catch { return undefined }
  }

  async createWithItems(data: SalePayload): Promise<Sale> {
    const res = await apiPost<any>('/api/sales', data)
    dataChangeEmitter.notifyCreate('sales')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('products')
    return res.sale || res
  }

  // تعديل كامل للفاتورة (بما فيها الأصناف) — يفك تغليف { sale } كما في createWithItems
  async updateWithItems(id: string, data: SalePayload): Promise<Sale> {
    const res = await apiPut<any>(`/api/sales/${id}`, data)
    dataChangeEmitter.notifyUpdate('sales')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('products')
    return res.sale || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/sales/${id}`)
    dataChangeEmitter.notifyDelete('sales')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('products')
  }
}

export const saleRepository = new SaleRepository()
