import { BaseRepository } from './base'
import { getDB } from '../connection'
import type { Customer, Sale } from '../types'

class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('customers', true)
  }

  async search(query: string): Promise<Customer[]> {
    const all = await this.getAll()
    if (!query) return all
    const q = query.toLowerCase()
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q)
    )
  }

  async getWithStats(customerId: string): Promise<{
    customer: Customer
    totalSales: number
    totalPaid: number
    totalRemaining: number
    salesCount: number
    sales: Sale[]
  } | null> {
    const customer = await this.getById(customerId)
    if (!customer) return null

    const db = await getDB()
    const allSales = await db.getAll('sales')
    const sales = allSales
      .filter((s) => s.customerId_ref === customerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const totalSales = sales.reduce((s, x) => s + x.total, 0)
    const totalPaid = sales.reduce((s, x) => s + x.paid, 0)

    return {
      customer,
      totalSales,
      totalPaid,
      totalRemaining: totalSales - totalPaid,
      salesCount: sales.length,
      sales,
    }
  }

  async getAllWithStats(): Promise<Array<Customer & {
    totalSales: number
    totalPaid: number
    totalRemaining: number
    salesCount: number
  }>> {
    const customers = await this.getAll()
    const result: Array<Customer & {
      totalSales: number
      totalPaid: number
      totalRemaining: number
      salesCount: number
    }> = []
    for (const c of customers) {
      const stats = await this.getWithStats(c.id)
      if (stats) {
        result.push({
          ...c,
          totalSales: stats.totalSales,
          totalPaid: stats.totalPaid,
          totalRemaining: stats.totalRemaining,
          salesCount: stats.salesCount,
        })
      }
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

export const customerRepository = new CustomerRepository()
