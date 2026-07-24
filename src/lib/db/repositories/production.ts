import { BaseRepository } from './base'
import type { Production } from '../types'

class ProductionRepository extends BaseRepository<Production> {
  constructor() {
    super('production', true)
  }

  async getByWorker(workerId: string): Promise<Production[]> {
    const result = await this.getByIndex('by-worker', workerId)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<Production[]> {
    let result: Production[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('production', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      result = await this.getAll()
    }

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
    return this.create({
      ...data,
      total,
    })
  }
}

export const productionRepository = new ProductionRepository()
