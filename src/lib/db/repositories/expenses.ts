import { BaseRepository } from './base'
import type { Expense } from '../types'

class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super('expenses')
  }

  async search(query?: string, from?: string, to?: string, _categoryId?: string): Promise<Expense[]> {
    return super.search(query, from, to)
  }

  async createWithCategory(data: {
    categoryId: string
    categoryName: string
    amount: number
    date: string
    notes?: string
  }): Promise<Expense> {
    return this.create({
      categoryId: data.categoryId,
      categoryName: data.categoryName,
      amount: data.amount,
      date: data.date,
      notes: data.notes,
    })
  }

  async getByCategory(_categoryId: string): Promise<Expense[]> {
    return this.getAll()
  }
}

export const expenseRepository = new ExpenseRepository()