'use client'
import { BaseRepository } from './base'
import { apiGet } from '../../api-client'
import type { Supplier, Purchase } from '../types'

class SupplierRepository extends BaseRepository<Supplier> {
  constructor() { super('/api/suppliers', 'suppliers', 'suppliers') }

  async search(query: string): Promise<Supplier[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async getWithStats(supplierId: string): Promise<{ supplier: Supplier; totalPurchases: number; totalPaid: number; totalReturns: number; standalonePayments: number; totalRemaining: number; purchasesCount: number; purchases: Purchase[]; returns: any[]; payments: any[] } | null> {
    try {
      const res = await apiGet<any>(`/api/supplier-report/${supplierId}`)
      // العقد: GET /api/supplier-report/[id] → { supplier, range, summary, purchases, returns, payments }
      const summary = res.summary || {}
      return {
        supplier: res.supplier,
        totalPurchases: summary.totalPurchases ?? res.totalPurchases ?? 0,
        totalPaid: summary.totalPaid ?? res.totalPaid ?? 0,
        totalReturns: summary.totalReturns ?? 0,
        standalonePayments: summary.standalonePayments ?? 0,
        totalRemaining: summary.totalRemaining ?? res.totalRemaining ?? 0,
        purchasesCount: summary.purchasesCount ?? (res.purchases || []).length,
        purchases: res.purchases || [],
        returns: res.returns || [],
        payments: res.payments || [],
      }
    } catch { return null }
  }

  async getAllWithStats(): Promise<Array<Supplier & { totalPurchases: number; totalPaid: number; totalRemaining: number; purchasesCount: number }>> {
    const suppliers = await this.getAll()
    return suppliers as any
  }
}

export const supplierRepository = new SupplierRepository()
