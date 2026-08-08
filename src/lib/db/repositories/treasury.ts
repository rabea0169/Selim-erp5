'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { TreasuryTransaction } from '../types'

export interface TreasurySummary {
  totalDeposits: number
  totalWithdrawals: number
  balance: number
}

class TreasuryRepository extends BaseRepository<TreasuryTransaction> {
  constructor() { super('/api/treasury-transactions', 'transactions', 'treasuryTransactions') }

  async getByDateRange(from?: string, to?: string, type?: string): Promise<TreasuryTransaction[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    if (type) params.type = type
    return this.getAll(params)
  }

  /**
   * ملخص الخزينة المحسوب في السيرفر عبر aggregate على كامل الجدول
   * (لا يتأثر بحد الصفحة 999 ولا بالفلاتر ما لم تُمرَّر صراحةً)
   */
  async getSummary(params?: Record<string, string>): Promise<TreasurySummary> {
    const res: any = await apiGet(this.basePath, { limit: '1', ...params })
    const s = res?.summary || {}
    return {
      totalDeposits: Number(s.totalDeposits) || 0,
      totalWithdrawals: Number(s.totalWithdrawals) || 0,
      balance: Number(s.balance) || 0,
    }
  }

  async getBalance(): Promise<number> {
    const s = await this.getSummary()
    return s.balance
  }

  async getDepositsTotal(): Promise<number> {
    const s = await this.getSummary()
    return s.totalDeposits
  }

  async getWithdrawalsTotal(): Promise<number> {
    const s = await this.getSummary()
    return s.totalWithdrawals
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
