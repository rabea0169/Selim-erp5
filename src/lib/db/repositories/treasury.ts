import { BaseRepository } from './base'
import type { TreasuryTransaction } from '../types'

class TreasuryRepository extends BaseRepository<TreasuryTransaction> {
  constructor() {
    super('treasuryTransactions', false)
  }

  async getByDateRange(from?: string, to?: string): Promise<TreasuryTransaction[]> {
    let result: TreasuryTransaction[]
    if (from || to) {
      const db = await this.getDB() as any
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('treasuryTransactions', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        result = await db.getAllFromIndex('treasuryTransactions', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        result = await db.getAllFromIndex('treasuryTransactions', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      result = await this.getAll()
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getBalance(): Promise<number> {
    const all = await this.getAll()
    return all.reduce((balance, t) => {
      if (t.type === 'deposit') return balance + t.amount
      if (t.type === 'withdrawal') return balance - t.amount
      return balance // transfer لا يؤثر على الرصيد الكلي
    }, 0)
  }

  async getDepositsTotal(): Promise<number> {
    const all = await this.getAll()
    return all.filter((t) => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  }

  async getWithdrawalsTotal(): Promise<number> {
    const all = await this.getAll()
    return all.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
  }

  async deposit(data: Omit<TreasuryTransaction, 'id' | 'createdAt'>): Promise<TreasuryTransaction> {
    return this.create({ ...data, type: 'deposit' })
  }

  async withdraw(data: Omit<TreasuryTransaction, 'id' | 'createdAt'>): Promise<TreasuryTransaction> {
    return this.create({ ...data, type: 'withdrawal' })
  }
}

export const treasuryRepository = new TreasuryRepository()
