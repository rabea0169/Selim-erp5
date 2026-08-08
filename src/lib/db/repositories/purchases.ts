'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Purchase } from '../types'

interface PurchasePayload {
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
  items: Array<{ itemName: string; materialId?: string; quantity: number; unitPrice: number }>
}

class PurchaseRepository extends BaseRepository<Purchase> {
  constructor() { super('/api/purchases', 'purchases', 'purchases') }

  async search(query: string, from?: string, to?: string): Promise<Purchase[]> {
    const params: Record<string, string> = {}
    if (query) params.q = query
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getByDateRange(from?: string, to?: string): Promise<Purchase[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getById(id: string): Promise<Purchase | undefined> {
    try {
      const res = await apiGet<any>(`/api/purchases/${id}`)
      return res.purchase || res
    } catch { return undefined }
  }

  async createWithItems(data: PurchasePayload): Promise<Purchase> {
    const res = await apiPost<any>('/api/purchases', data)
    dataChangeEmitter.notifyCreate('purchases')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
    return res.purchase || res
  }

  async updateWithItems(id: string, data: PurchasePayload): Promise<Purchase> {
    const res = await apiPut<any>(`/api/purchases/${id}`, data)
    dataChangeEmitter.notifyUpdate('purchases')
    dataChangeEmitter.notifyUpdate('materials')
    dataChangeEmitter.notifyUpdate('materialTransactions')
    return res.purchase || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/purchases/${id}`)
    dataChangeEmitter.notifyDelete('purchases')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
  }
}

export const purchaseRepository = new PurchaseRepository()
