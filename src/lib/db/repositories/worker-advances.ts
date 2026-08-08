'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { WorkerAdvance } from '../types'

class WorkerAdvanceRepository extends BaseRepository<WorkerAdvance> {
  constructor() { super('/api/worker-advances', 'workerAdvances', 'workerAdvances') }

  async getByWorker(workerId: string): Promise<WorkerAdvance[]> {
    return this.getAll({ workerId })
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerAdvance[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    if (workerId) params.workerId = workerId
    return this.getAll(params)
  }

  async create(data: Partial<WorkerAdvance>): Promise<WorkerAdvance> {
    const res = await apiPost<any>('/api/worker-advances', data)
    dataChangeEmitter.notifyCreate('workerAdvances')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    return res.workerAdvance || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/worker-advances/${id}`)
    dataChangeEmitter.notifyDelete('workerAdvances')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
  }
}

export const workerAdvanceRepository = new WorkerAdvanceRepository()
