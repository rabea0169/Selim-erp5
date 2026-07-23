// أنواع مشتركة لقسم المصاريف

export interface ExpenseCategory {
  id: string
  name: string
  notes: string | null
  expenseCount?: number
}

export interface Expense {
  id: string
  categoryId: string
  categoryName: string
  amount: number
  date: string
  notes: string | null
}
