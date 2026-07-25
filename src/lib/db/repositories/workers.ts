import { BaseRepository } from './base'
import type { Worker } from '../types'

class WorkerRepository extends BaseRepository<Worker> {
  constructor() {
    super('workers')
  }

  async search(query: string): Promise<Worker[]> {
    return this.getAll() // API يتعامل مع البحث
  }

  // API يعيد totalAdvances, totalReceipts, balance مباشرة
  async getAllWithStats(): Promise<Array<Worker & {
    totalAdvances: number
    totalReceipts: number
    balance: number
  }>> {
    const all = await this.getAll()
    return all.map((w: any) => ({
      ...w,
      totalAdvances: w.totalAdvances || 0,
      totalReceipts: w.totalReceipts || 0,
      balance: w.balance || 0,
    }))
  }

  async deleteWithRelations(workerId: string): Promise<void> {
    // API يحذف الموظف والسجلات المرتبطة (cascade في الـ schema)
    await this.delete(workerId)
  }
}

export const workerRepository = new WorkerRepository()