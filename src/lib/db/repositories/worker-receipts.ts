import { BaseRepository } from './base'
import { getDB, generateId, nowISO } from '../connection'
import { workerRepository } from './workers'
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

  // إنشاء قبض + إيداع في الخزينة تلقائياً
  async create(data: Partial<WorkerReceipt>): Promise<WorkerReceipt> {
    const record = await super.create(data)

    // إيداع في الخزينة
    if (record.amount > 0 && record.workerId) {
      try {
        const worker = await workerRepository.getById(record.workerId)
        const db = await getDB()
        const treasuryTx = {
          id: generateId(),
          type: 'deposit' as const,
          amount: record.amount,
          date: record.date,
          description: `قبض من موظف - ${worker?.name || 'موظف'}`,
          category: 'قبض موظفين',
          referenceType: 'worker_receipt',
          referenceId: record.id,
          notes: record.notes,
          createdAt: nowISO(),
        }
        await db.add('treasuryTransactions', treasuryTx)
      } catch (e) {
        console.error('Failed to create treasury transaction for receipt:', e)
      }
    }

    return record
  }

  // حذف قبض + حذف المعاملة من الخزينة
  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['workerReceipts', 'treasuryTransactions'], 'readwrite')

    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'worker_receipt' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    await tx.objectStore('workerReceipts').delete(id)
    await tx.done
  }
}

export const workerReceiptRepository = new WorkerReceiptRepository()
