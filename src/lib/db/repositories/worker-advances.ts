import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { workerRepository } from './workers'
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

  private async getByDateRangeBase(indexName: string, from?: string, to?: string): Promise<WorkerAdvance[]> {
    const db = await this.getDB()
    if (from && to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.bound(from, toDate.toISOString()))
    } else if (from) {
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.lowerBound(from))
    } else if (to) {
      const toDate = new Date(to)
      toDate.setHours(23, 59, 59, 999)
      return (db as any).getAllFromIndex(this.storeName, indexName, IDBKeyRange.upperBound(toDate.toISOString()))
    }
    return this.getAll()
  }

  // إنشاء سلفة + سحب من الخزينة تلقائياً (معاملة ذرية)
  async create(data: Partial<WorkerAdvance>): Promise<WorkerAdvance> {
    const now = nowISO()
    const id = data.id || generateId()
    const record = {
      ...data,
      id,
      createdAt: (data as any).createdAt || now,
      updatedAt: (data as any).updatedAt || now,
    } as WorkerAdvance

    const db = await getDB()
    const tx = db.transaction(['workerAdvances', 'treasuryTransactions'], 'readwrite')

    await tx.objectStore('workerAdvances').add(record)

    // سحب من الخزينة في نفس المعاملة
    if (record.amount > 0 && record.workerId) {
      const worker = await workerRepository.getById(record.workerId)
      const treasuryTx = {
        id: generateId(),
        type: 'withdrawal' as const,
        amount: record.amount,
        date: record.date,
        description: `سلفة موظف - ${worker?.name || 'موظف'}`,
        category: 'سلف موظفين',
        referenceType: 'worker_advance',
        referenceId: record.id,
        notes: record.notes,
        createdAt: nowISO(),
      }
      await tx.objectStore('treasuryTransactions').add(treasuryTx)
    }

    await tx.done
    return record
  }

  // حذف سلفة + حذف المعاملة من الخزينة
  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['workerAdvances', 'treasuryTransactions'], 'readwrite')

    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'worker_advance' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    await tx.objectStore('workerAdvances').delete(id)
    await tx.done
  }
}

export const workerAdvanceRepository = new WorkerAdvanceRepository()
