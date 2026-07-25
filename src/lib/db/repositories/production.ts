import { BaseRepository } from './base'
import type { Production } from '../types'

class ProductionRepository extends BaseRepository<Production> {
  constructor() {
    super('production')
  }

  async getByWorker(workerId: string): Promise<Production[]> {
    const result = await this.getAll()
    return result
      .filter((p) => p.workerId === workerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<Production[]> {
    let result = await super.search(undefined, from, to)
    if (workerId) {
      result = result.filter((p) => p.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async createWithCalculation(data: {
    workerId: string
    date: string
    modelName: string
    quantity: number
    unitPrice: number
    notes?: string
  }): Promise<Production> {
    const total = data.quantity * data.unitPrice
    return this.create({ ...data, total })
  }
}

export const productionRepository = new ProductionRepository()
