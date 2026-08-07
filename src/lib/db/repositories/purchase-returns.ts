'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { PurchaseReturn } from '../types'

class PurchaseReturnRepository extends BaseRepository<PurchaseReturn> {
  constructor() { super('/api/purchase-returns', 'purchaseReturns') }

  async getByDateRange(from?: string, to?: string): Promise<PurchaseReturn[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getById(id: string): Promise<PurchaseReturn | undefined> {
    try { return await apiGet<PurchaseReturn>(`/api/purchase-returns/${id}`) } catch { return undefined }
  }

  async createReturn(data: {
    purchaseId: string
    date: string
    reason?: string
    notes?: string
    items: Array<{ purchaseItemId: string; itemName: string; materialId?: string; quantity: number; unitPrice: number }>
  }): Promise<PurchaseReturn> {
    const res = await apiPost<any>('/api/purchase-returns', data)
    dataChangeEmitter.notifyCreate('purchaseReturns')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
    return res.purchaseReturn || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/purchase-returns/${id}`)
    dataChangeEmitter.notifyDelete('purchaseReturns')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    dataChangeEmitter.notifyUpdate('materials')
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository()
