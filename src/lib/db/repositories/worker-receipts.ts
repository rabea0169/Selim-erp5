import { BaseRepository } from './base'
import type { WorkerReceipt } from '../types'

class WorkerReceiptRepository extends BaseRepository<WorkerReceipt> {
  constructor() {
    super('workerReceipts')
  }

  async getByWorker(workerId: string): Promise<WorkerReceipt[]> {
    const result = await this.getAll()
    return result
      .filter((r) => r.workerId === workerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerReceipt[]> {
    let result = await super.search(undefined, from, to)
    if (workerId) {
      result = result.filter((r) => r.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}

export const workerReceiptRepository = new WorkerReceiptRepository()
