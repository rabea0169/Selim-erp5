import { BaseRepository } from './base'
import { getDB } from '../connection'
import type { Supplier, Purchase } from '../types'

class SupplierRepository extends BaseRepository<Supplier> {
  constructor() {
    super('suppliers', true)
  }

  async search(query: string): Promise<Supplier[]> {
    const all = await this.getAll()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.address || '').toLowerCase().includes(q)
    )
  }

  async getWithStats(supplierId: string): Promise<{
    supplier: Supplier
    totalPurchases: number
    totalPaid: number
    totalRemaining: number
    purchasesCount: number
    purchases: Purchase[]
  } | null> {
    const supplier = await this.getById(supplierId)
    if (!supplier) return null

    const db = await getDB()
    const allPurchases = await db.getAll('purchases')
    const purchases = allPurchases
      .filter((p) => p.supplierId_ref === supplierId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const totalPurchases = purchases.reduce((s, x) => s + x.total, 0)
    const totalPaid = purchases.reduce((s, x) => s + x.paid, 0)

    return {
      supplier,
      totalPurchases,
      totalPaid,
      totalRemaining: totalPurchases - totalPaid,
      purchasesCount: purchases.length,
      purchases,
    }
  }

  async getAllWithStats(): Promise<Array<Supplier & {
    totalPurchases: number
    totalPaid: number
    totalRemaining: number
    purchasesCount: number
  }>> {
    const suppliers = await this.getAll()
    const result: Array<Supplier & {
      totalPurchases: number
      totalPaid: number
      totalRemaining: number
      purchasesCount: number
    }> = []
    for (const s of suppliers) {
      const stats = await this.getWithStats(s.id)
      if (stats) {
        result.push({
          ...s,
          totalPurchases: stats.totalPurchases,
          totalPaid: stats.totalPaid,
          totalRemaining: stats.totalRemaining,
          purchasesCount: stats.purchasesCount,
        })
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

export const supplierRepository = new SupplierRepository()
