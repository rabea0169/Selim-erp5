import { BaseRepository } from './base'
import type { Customer, Sale } from '../types'

class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super('customers')
  }

  async search(query: string): Promise<Customer[]> {
    return this.getAll() // API يتعامل مع البحث
  }

  // API يعيد totalSales, totalPaid, totalRemaining, salesCount مباشرة
  async getAllWithStats(): Promise<Array<Customer & {
    totalSales: number
    totalPaid: number
    totalRemaining: number
    salesCount: number
  }>> {
    const all = await this.getAll()
    return all.map((c: any) => ({
      ...c,
      totalSales: c.totalSales || 0,
      totalPaid: c.totalPaid || 0,
      totalRemaining: c.totalRemaining || 0,
      salesCount: c.salesCount || 0,
    }))
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
    const c = customer as any
    return {
      customer,
      totalSales: c.totalSales || 0,
      totalPaid: c.totalPaid || 0,
      totalRemaining: c.totalRemaining || 0,
      salesCount: c.salesCount || 0,
      sales: [],
    }
  }
}

export const customerRepository = new CustomerRepository()