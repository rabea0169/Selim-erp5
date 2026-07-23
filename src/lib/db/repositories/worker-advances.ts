import { BaseRepository } from './base'
import type { WorkerAdvance } from '../types'

class WorkerAdvanceRepository extends BaseRepository<WorkerAdvance> {
  constructor() {
    super('workerAdvances', true)
  }

  async getByWorker(workerId: string): Promise<WorkerAdvance[]> {
    const result = await this.getByIndex('by-worker', workerId)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAdvance[]> {
    let result = await this.getByDateRangeBase('by-date', from, to)
    if (workerId) {
      result = result.filter((a) => a.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  // ميثود مساعدة لأن BaseRepository.getByDateRange مش بيشتغل مع الـ index صح
  private async getByDateRangeBase(indexName: string, from?: string, to?: string): Promise<WorkerAdvance[]> {
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

export const workerAdvanceRepository = new WorkerAdvanceRepository()
