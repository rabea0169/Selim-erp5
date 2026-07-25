import { BaseRepository } from './base'
import type { PurchaseReturn } from '../types'

class PurchaseReturnRepository extends BaseRepository<PurchaseReturn> {
  constructor() {
    super('purchaseReturns', '/api/purchase-returns', 'returns', 'return')
  }

  async search(query?: string, from?: string, to?: string): Promise<PurchaseReturn[]> {
    return super.search(query, from, to)
  }

  async createWithItems(data: any): Promise<PurchaseReturn> {
    return this.create(data)
  }
}

export const purchaseReturnRepository = new PurchaseReturnRepository()
