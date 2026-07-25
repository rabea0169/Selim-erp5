import { BaseRepository } from './base'
import type { SaleReturn } from '../types'

class SaleReturnRepository extends BaseRepository<SaleReturn> {
  constructor() {
    super('saleReturns', '/api/sale-returns', 'returns', 'return')
  }

  async search(query?: string, from?: string, to?: string): Promise<SaleReturn[]> {
    return super.search(query, from, to)
  }

  async createWithItems(data: any): Promise<SaleReturn> {
    return this.create(data)
  }
}

export const saleReturnRepository = new SaleReturnRepository()
