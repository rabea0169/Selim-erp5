'use client'

import { BaseRepository } from './base'
import { apiPost } from '../../api-client'
import type { ExpenseCategory } from '../types'

/**
 * Expense category repository — API-based.
 * GET /api/expense-categories returns { categories: [...], pagination: {...} }
 * create/update/delete notifications are emitted centrally by BaseRepository
 * via the entityType passed to the constructor.
 */
class ExpenseCategoryRepository extends BaseRepository<ExpenseCategory> {
  constructor() {
    super('/api/expense-categories', 'categories', 'expenseCategories')
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
}

const expenseCategoryRepository = new ExpenseCategoryRepository()

export { expenseCategoryRepository }
