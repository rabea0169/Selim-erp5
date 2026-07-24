import { BaseRepository } from './base'
import type { ExpenseCategory } from '../types'

class ExpenseCategoryRepository extends BaseRepository<ExpenseCategory> {
  constructor() {
    super('expenseCategories', true)
  }

  async getByName(name: string): Promise<ExpenseCategory | undefined> {
    const all = await this.getAll()
    return all.find((c) => c.name === name)
  }

  async seedDefaults(): Promise<{ created: number; total: number }> {
    const defaults = [
      'كهرباء', 'مياه', 'إيجار', 'مرتبات', 'خامات',
      'صيانة', 'نقل ومواصلات', 'مصاريف إدارية', 'أخرى',
    ]

    let created = 0
    for (const name of defaults) {
      const existing = await this.getByName(name)
      if (!existing) {
        await this.create({ name })
        created++
      }
    }

    const total = await this.count()
    return { created, total }
  }
}

export const expenseCategoryRepository = new ExpenseCategoryRepository()
