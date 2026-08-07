'use client'
import { BaseRepository } from './base'
import { apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Expense } from '../types'

class ExpenseRepository extends BaseRepository<Expense> {
  constructor() { super('/api/expenses', 'expenses') }

  async search(query: string, from?: string, to?: string, categoryId?: string): Promise<Expense[]> {
    const params: Record<string, string> = {}
    if (query) params.q = query
    if (from) params.from = from
    if (to) params.to = to
    if (categoryId) params.categoryId = categoryId
    return this.getAll(params)
  }

  async getByDateRange(from?: string, to?: string): Promise<Expense[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async createWithCategory(data: { categoryId: string; amount: number; date: string; notes?: string }): Promise<Expense> {
    const res = await apiPost<any>('/api/expenses', data)
    dataChangeEmitter.notifyCreate('expenses')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    return res.expense || res
  }

  async delete(id: string): Promise<void> {
    await apiDelete(`/api/expenses/${id}`)
    dataChangeEmitter.notifyDelete('expenses')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
  }

  async getByCategory(categoryId: string): Promise<Expense[]> {
    return this.getAll({ categoryId })
  }
}

export const expenseRepository = new ExpenseRepository()
