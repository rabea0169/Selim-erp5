'use client'
import { BaseRepository } from './base'
import { apiGet } from '../../api-client'
import type { Supplier, Purchase } from '../types'

class SupplierRepository extends BaseRepository<Supplier> {
  constructor() { super('/api/suppliers', 'suppliers') }

  async search(query: string): Promise<Supplier[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async getWithStats(supplierId: string): Promise<{ supplier: Supplier; totalPurchases: number; totalPaid: number; totalRemaining: number; purchasesCount: number; purchases: Purchase[] } | null> {
    try {
      const res = await apiGet<any>(`/api/supplier-report/${supplierId}`)
      return {
        supplier: res.supplier,
        totalPurchases: res.totalPurchases || 0,
        totalPaid: res.totalPaid || 0,
        totalRemaining: res.totalRemaining || 0,
        purchasesCount: (res.purchases || []).length,
        purchases: res.purchases || [],
      }
    } catch { return null }
  }

  async getAllWithStats(): Promise<Array<Supplier & { totalPurchases: number; totalPaid: number; totalRemaining: number; purchasesCount: number }>> {
    const suppliers = await this.getAll()
    return suppliers
  }
}

export const supplierRepository = new SupplierRepository()
