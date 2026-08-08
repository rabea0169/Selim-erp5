'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { SaleReturn } from '../types'

class SaleReturnRepository extends BaseRepository<SaleReturn> {
  constructor() { super('/api/sale-returns', 'saleReturns', 'saleReturns') }

  async getByDateRange(from?: string, to?: string): Promise<SaleReturn[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getById(id: string): Promise<SaleReturn | undefined> {
    try { return await apiGet<SaleReturn>(`/api/sale-returns/${id}`) } catch { return undefined }
  }

  async createReturn(data: {
    saleId: string
    date: string
    reason?: string
    restockItems: boolean
    notes?: string
    items: Array<{ saleItemId: string; itemName: string; productId?: string; quantity: number; unitPrice: number }>
  }): Promise<SaleReturn> {
    const res = await apiPost<any>('/api/sale-returns', data)
    dataChangeEmitter.notifyCreate('saleReturns')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (data.restockItems) dataChangeEmitter.notifyUpdate('products')
    return res.saleReturn || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/sale-returns/${id}`)
    dataChangeEmitter.notifyDelete('saleReturns')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('products')
  }
}

export const saleReturnRepository = new SaleReturnRepository()
