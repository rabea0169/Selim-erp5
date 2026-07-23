import { BaseRepository } from './base'
import type { WorkerReceipt } from '../types'

class WorkerReceiptRepository extends BaseRepository<WorkerReceipt> {
  constructor() {
    super('workerReceipts', true)
  }

  async getByWorker(workerId: string): Promise<WorkerReceipt[]> {
    const result = await this.getByIndex('by-worker', workerId)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerReceipt[]> {
    let result = await this.getByDateRangeBase('by-date', from, to)
    if (workerId) {
      result = result.filter((r) => r.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  private async getByDateRangeBase(indexName: string, from?: string, to?: string): Promise<WorkerReceipt[]> {
    const db = await this.getDB()
    if (from && to) {
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.bound(from, to))
    } else if (from) {
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.lowerBound(from))
    } else if (to) {
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.upperBound(to))
    }
    return this.getAll()
  }
}

export const workerReceiptRepository = new WorkerReceiptRepository()
