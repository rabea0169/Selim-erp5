'use client'

import { BaseRepository } from './base'
import { apiPost } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { ExpenseCategory } from '../types'

/**
 * Expense category repository — API-based.
 * GET /api/expense-categories returns { categories: [...], pagination: {...} }
 */
class ExpenseCategoryRepository extends BaseRepository<ExpenseCategory> {
  constructor() {
    super('/api/expense-categories', 'categories')
  }

  /** Find a category by its name */
  async getByName(name: string): Promise<ExpenseCategory | undefined> {
    const all = await this.getAll()
    return all.find(c => c.name === name)
  }

  /** Seed default categories (server handles the actual seeding) */
  async seedDefaults(): Promise<{ created: number; total: number }> {
    try {
      await apiPost('/api/seed')
    } catch {
      // Seeding may have already been done — ignore errors
    }
    return { created: 0, total: 0 }
  }

  /** Override create to notify listeners */
  async create(data: any): Promise<ExpenseCategory> {
    const result = await super.create(data)
    dataChangeEmitter.notifyCreate('expenseCategories')
    return result
  }

  /** Override update to notify listeners */
  async update(id: string, data: any): Promise<ExpenseCategory> {
    const result = await super.update(id, data)
    dataChangeEmitter.notifyUpdate('expenseCategories')
    return result
  }

  /** Override delete to notify listeners */
  async delete(id: string): Promise<void> {
    await super.delete(id)
    dataChangeEmitter.notifyDelete('expenseCategories')
  }
}

const expenseCategoryRepository = new ExpenseCategoryRepository()

export { expenseCategoryRepository }
