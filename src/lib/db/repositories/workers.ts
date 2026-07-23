import { BaseRepository } from './base'
import { getDB } from '../connection'
import type { Worker, WorkerAdvance, WorkerReceipt, WorkerAttendance, Production } from '../types'

class WorkerRepository extends BaseRepository<Worker> {
  constructor() {
    super('workers', true)
  }

  async search(query: string): Promise<Worker[]> {
    const all = await this.getAll()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (w.phone || '').includes(q) ||
        (w.job || '').toLowerCase().includes(q)
    )
  }

  async getWithStats(workerId: string): Promise<{
    worker: Worker
    totalAdvances: number
    totalReceipts: number
    balance: number
    advances: WorkerAdvance[]
    receipts: WorkerReceipt[]
  } | null> {
    const worker = await this.getById(workerId)
    if (!worker) return null

    const db = await getDB()
    const advances = await db.getAllFromIndex('workerAdvances', 'by-worker', workerId)
    const receipts = await db.getAllFromIndex('workerReceipts', 'by-worker', workerId)

    const totalAdvances = advances.reduce((s, a) => s + a.amount, 0)
    const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0)

    return {
      worker,
      totalAdvances,
      totalReceipts,
      balance: totalAdvances - totalReceipts,
      advances: advances.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      receipts: receipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }
  }

  async getAllWithStats(): Promise<Array<Worker & {
    totalAdvances: number
    totalReceipts: number
    balance: number
    advances: WorkerAdvance[]
    receipts: WorkerReceipt[]
  }>> {
    const workers = await this.getAll()
    const result: Array<Worker & {
      totalAdvances: number
      totalReceipts: number
      balance: number
      advances: WorkerAdvance[]
      receipts: WorkerReceipt[]
    }> = []
    for (const w of workers) {
      const stats = await this.getWithStats(w.id)
      if (stats) {
        result.push({ ...w, ...stats, worker: undefined })
      }
    }
    return result
  }

  // حذف الموظف مع كل السجلات المرتبطة (cascade)
  async deleteWithRelations(workerId: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(
      ['workers', 'workerAdvances', 'workerReceipts', 'workerAttendance', 'production'],
      'readwrite'
    )

    // حذف السلف
    const advances = await tx.objectStore('workerAdvances').index('by-worker').getAllKeys(workerId)
    await Promise.all(advances.map((k) => tx.objectStore('workerAdvances').delete(k)))

    // حذف القبض
    const receipts = await tx.objectStore('workerReceipts').index('by-worker').getAllKeys(workerId)
    await Promise.all(receipts.map((k) => tx.objectStore('workerReceipts').delete(k)))

    // حذف الحضور
    const attendance = await tx.objectStore('workerAttendance').index('by-worker').getAllKeys(workerId)
    await Promise.all(attendance.map((k) => tx.objectStore('workerAttendance').delete(k)))

    // حذف الإنتاج
    const production = await tx.objectStore('production').index('by-worker').getAllKeys(workerId)
    await Promise.all(production.map((k) => tx.objectStore('production').delete(k)))

    // حذف الموظف
    await tx.objectStore('workers').delete(workerId)

    await tx.done
  }
}

export const workerRepository = new WorkerRepository()
