'use client'
import { BaseRepository } from './base'
import { apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { WorkerReceipt } from '../types'

class WorkerReceiptRepository extends BaseRepository<WorkerReceipt> {
  constructor() { super('/api/worker-receipts', 'workerReceipts') }

  async getByWorker(workerId: string): Promise<WorkerReceipt[]> {
    return this.getAll({ workerId })
  }

  async getByDateRange(from?: string, to?: string, workerId?: string): Promise<WorkerReceipt[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    if (workerId) params.workerId = workerId
    return this.getAll(params)
  }

  async create(data: Partial<WorkerReceipt>): Promise<WorkerReceipt> {
    const res = await apiPost<any>('/api/worker-receipts', data)
    dataChangeEmitter.notifyCreate('workerReceipts')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    return res.workerReceipt || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/worker-receipts/${id}`)
    dataChangeEmitter.notifyDelete('workerReceipts')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
  }
}

export const workerReceiptRepository = new WorkerReceiptRepository()
