'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { TreasuryTransaction } from '../types'

class TreasuryRepository extends BaseRepository<TreasuryTransaction> {
  constructor() { super('/api/treasury-transactions', 'transactions') }

  async getByDateRange(from?: string, to?: string): Promise<TreasuryTransaction[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
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

  async deposit(data: Omit<TreasuryTransaction, 'id' | 'createdAt'>): Promise<TreasuryTransaction> {
    const res = await apiPost<any>('/api/treasury-transactions', { ...data, type: 'deposit' })
    dataChangeEmitter.notifyCreate('treasuryTransactions')
    return res.transaction || res
  }

  async withdraw(data: Omit<TreasuryTransaction, 'id' | 'createdAt'>): Promise<TreasuryTransaction> {
    const res = await apiPost<any>('/api/treasury-transactions', { ...data, type: 'withdrawal' })
    dataChangeEmitter.notifyCreate('treasuryTransactions')
    return res.transaction || res
  }
}

export const treasuryRepository = new TreasuryRepository()
