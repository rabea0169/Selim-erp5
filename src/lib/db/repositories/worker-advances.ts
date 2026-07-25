import { BaseRepository } from './base'
import type { WorkerAdvance } from '../types'

class WorkerAdvanceRepository extends BaseRepository<WorkerAdvance> {
  constructor() {
    super('workerAdvances')
  }

  async getByWorker(workerId: string): Promise<WorkerAdvance[]> {
    const result = await this.getAll()
    return result
      .filter((a) => a.workerId === workerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAdvance[]> {
    let result = await super.search(undefined, from, to)
    if (workerId) {
      result = result.filter((a) => a.workerId === workerId)
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }
}

export const workerAdvanceRepository = new WorkerAdvanceRepository()
