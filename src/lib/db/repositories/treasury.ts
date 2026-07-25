import { BaseRepository } from './base'
import type { TreasuryTransaction } from '../types'

class TreasuryRepository extends BaseRepository<TreasuryTransaction> {
  constructor() {
    super('treasuryTransactions')
  }

  async getByDateRange(from?: string, to?: string): Promise<TreasuryTransaction[]> {
    const result = await super.search(undefined, from, to)
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getBalance(): Promise<number> {
    const all = await this.getAll()
    return all.reduce((balance, t) => {
      if (t.type === 'deposit') return balance + t.amount
      if (t.type === 'withdrawal') return balance - t.amount
      return balance
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

  async deposit(data: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    return this.create({ ...data, type: 'deposit' })
  }

  async withdraw(data: Partial<TreasuryTransaction>): Promise<TreasuryTransaction> {
    return this.create({ ...data, type: 'withdrawal' })
  }
}

export const treasuryRepository = new TreasuryRepository()
