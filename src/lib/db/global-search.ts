'use client'

import {
  saleRepository,
  purchaseRepository,
  workerRepository,
  customerRepository,
  supplierRepository,
  expenseRepository,
} from './repositories'

export interface SearchResult {
  type: 'sale' | 'purchase' | 'worker' | 'customer' | 'supplier' | 'expense'
  id: string
  title: string
  subtitle: string
  amount?: number
  date?: string
  icon: string
}

class GlobalSearchService {
  async search(query: string): Promise<SearchResult[]> {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const results: SearchResult[] = []

    try {
      const [sales, purchases, workers, customers, suppliers, expenses] = await Promise.all([
        saleRepository.search(query),
        purchaseRepository.search(query),
        workerRepository.search(query),
        customerRepository.search(query),
        supplierRepository.search(query),
        expenseRepository.search(query),
      ])

      // المبيعات
      for (const s of sales.slice(0, 5)) {
        results.push({
          type: 'sale',
          id: s.id,
          title: `فاتورة: ${s.customerName}`,
          subtitle: `مبيعة - ${s.items.length} صنف`,
          amount: s.total,
          date: s.date,
          icon: '🛒',
        })
      }

      // المشتريات
      for (const p of purchases.slice(0, 5)) {
        results.push({
          type: 'purchase',
          id: p.id,
          title: `فاتورة: ${p.supplierName}`,
          subtitle: `مشتريات - ${p.items.length} صنف`,
          amount: p.total,
          date: p.date,
          icon: '📦',
        })
      }

      // الموظفين
      for (const w of workers.slice(0, 5)) {
        results.push({
          type: 'worker',
          id: w.id,
          title: w.name,
          subtitle: w.job || 'موظف',
          icon: '👷',
        })
      }

      // العملاء
      for (const c of customers.slice(0, 5)) {
        results.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: c.phone || 'عميل',
          icon: '👥',
        })
      }

      // الموردين
      for (const s of suppliers.slice(0, 5)) {
        results.push({
          type: 'supplier',
          id: s.id,
          title: s.name,
          subtitle: s.phone || 'مورد',
          icon: '🚚',
        })
      }

      // المصاريف
      for (const e of expenses.slice(0, 5)) {
        results.push({
          type: 'expense',
          id: e.id,
          title: e.categoryName,
          subtitle: e.notes || 'مصروف',
          amount: e.amount,
          date: e.date,
          icon: '💸',
        })
      }
    } catch (e) {
      console.error('Search error:', e)
    }

    return results
  }
}

export const globalSearchService = new GlobalSearchService()
