import { BaseRepository } from './base'
import type { Supplier } from '../types'

class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('suppliers')
  }

  async search(query: string): Promise<Supplier[]> {
    return this.getAll() // API يتعامل مع البحث
  }

  // API يعيد totalPurchases, totalPaid, totalRemaining مباشرة
  async getAllWithStats(): Promise<Array<Supplier & {
    totalPurchases: number
    totalPaid: number
    totalRemaining: number
    purchasesCount: number
  }>> {
    const all = await this.getAll()
    return all.map((s: any) => ({
      ...s,
      totalPurchases: s.totalPurchases || 0,
      totalPaid: s.totalPaid || 0,
      totalRemaining: s.totalRemaining || 0,
      purchasesCount: s.purchasesCount || 0,
    }))
  }
}

export const supplierRepository = new SupplierRepository()