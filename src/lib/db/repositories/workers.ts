'use client'
import { BaseRepository } from './base'
import { apiGet } from '../../api-client'
import type { Worker, WorkerAdvance, WorkerReceipt } from '../types'

class WorkerRepository extends BaseRepository<Worker> {
  constructor() { super('/api/workers', 'workers', 'workers') }

  /** جلب موظف واحد — السيرفر يعيد { worker } لذا نفك التغليف */
  async getById(id: string): Promise<Worker | undefined> {
    try {
      const res: any = await apiGet<any>(`${this.basePath}/${id}`)
      return res?.worker ?? res
    } catch {
      return undefined
    }
  }

  async search(query: string): Promise<Worker[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async getWithStats(workerId: string): Promise<{ worker: Worker; totalAdvances: number; totalReceipts: number; balance: number; advances: WorkerAdvance[]; receipts: WorkerReceipt[] } | null> {
    try {
      const res = await apiGet<any>(`/api/worker-report/${workerId}`)
      // السيرفر يعيد الإجماليات داخل summary — مع fallback للمفاتيح القديمة
      const summary = res.summary || {}
      return {
        worker: res.worker,
        totalAdvances: summary.totalAdvances ?? res.totalAdvances ?? 0,
        totalReceipts: summary.totalReceipts ?? res.totalReceipts ?? 0,
        balance: summary.balance ?? res.balance ?? 0,
        advances: res.advances || [],
        receipts: res.receipts || [],
      }
    } catch { return null }
  }

  async getAllWithStats(): Promise<Array<Worker & { totalAdvances: number; totalReceipts: number; balance: number }>> {
    const workers = await this.getAll()
    return workers as any // Stats computed lazily when needed; for list view, basic data is enough
  }

  async deleteWithRelations(workerId: string): Promise<void> {
    await this.delete(workerId) // Server handles cascade delete
  }
}

export const workerRepository = new WorkerRepository()
