import { BaseRepository } from './base'
import { expenseCategoryRepository } from './expense-categories'
import { getDB, generateId, nowISO } from '../connection'
import type { Expense } from '../types'

class ExpenseRepository extends BaseRepository<Expense> {
  constructor() {
    super('expenses', true)
  }

  async search(query: string, from?: string, to?: string, categoryId?: string): Promise<Expense[]> {
    let expenses = await this.getByDateRange(from, to)
    if (categoryId) {
      expenses = expenses.filter((e) => e.categoryId === categoryId)
    }
    if (query) {
      expenses = expenses.filter((e) => (e.notes || '').toLowerCase().includes(query.toLowerCase()))
    }
    return expenses
  }

  async getByDateRange(from?: string, to?: string): Promise<Expense[]> {
    let expenses: Expense[]
    if (from || to) {
      const db = await this.getDB()
      if (from && to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        expenses = await db.getAllFromIndex('expenses', 'by-date', IDBKeyRange.bound(from, toDate.toISOString()))
      } else if (from) {
        expenses = await db.getAllFromIndex('expenses', 'by-date', IDBKeyRange.lowerBound(from))
      } else {
        const toDate = new Date(to!)
        toDate.setHours(23, 59, 59, 999)
        expenses = await db.getAllFromIndex('expenses', 'by-date', IDBKeyRange.upperBound(toDate.toISOString()))
      }
    } else {
      expenses = await this.getAll()
    }

    return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async createWithCategory(data: {
    categoryId: string
    amount: number
    date: string
    notes?: string
  }): Promise<Expense> {
    const category = await expenseCategoryRepository.getById(data.categoryId)
    if (!category) throw new Error('فئة المصروف غير موجودة')

    const db = await getDB()
    const tx = db.transaction(['expenses', 'treasuryTransactions'], 'readwrite')

    const now = nowISO()
    const expenseId = generateId()

    const expense: Expense = {
      id: expenseId,
      categoryId: data.categoryId,
      categoryName: category.name,
      amount: data.amount,
      date: data.date,
      notes: data.notes,
      createdAt: now,
    }

    await tx.objectStore('expenses').add(expense)

    // سحب من الخزينة تلقائياً
    const treasuryTx = {
      id: generateId(),
      type: 'withdrawal' as const,
      amount: data.amount,
      date: data.date,
      description: `مصروف - ${category.name}`,
      category: 'مصاريف',
      referenceType: 'expense',
      referenceId: expenseId,
      notes: data.notes,
      createdAt: now,
    }
    await tx.objectStore('treasuryTransactions').add(treasuryTx)

    await tx.done

    return expense
  }

  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['expenses', 'treasuryTransactions'], 'readwrite')

    // حذف المعاملة المرتبطة في الخزينة
    const allTreasury = await tx.objectStore('treasuryTransactions').getAll()
    for (const t of allTreasury) {
      if (t.referenceType === 'expense' && t.referenceId === id) {
        await tx.objectStore('treasuryTransactions').delete(t.id)
      }
    }

    await tx.objectStore('expenses').delete(id)
    await tx.done
  }

  async getByCategory(categoryId: string): Promise<Expense[]> {
    return this.getByIndex('by-category', categoryId)
  }
}

export const expenseRepository = new ExpenseRepository()
