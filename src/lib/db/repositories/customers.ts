'use client'
import { BaseRepository } from './base'
import { apiGet } from '../../api-client'
import type { Customer, Sale } from '../types'

class CustomerRepository extends BaseRepository<Customer> {
  constructor() { super('/api/customers', 'customers') }

  async search(query: string): Promise<Customer[]> {
    if (!query) return this.getAll()
    return this.getAll({ q: query })
  }

  async getWithStats(customerId: string): Promise<{ customer: Customer; totalSales: number; totalPaid: number; totalRemaining: number; salesCount: number; sales: Sale[] } | null> {
    try {
      const res = await apiGet<any>(`/api/customer-report/${customerId}`)
      return {
        customer: res.customer,
        totalSales: res.totalSales || 0,
        totalPaid: res.totalPaid || 0,
        totalRemaining: res.totalRemaining || 0,
        salesCount: (res.sales || []).length,
        sales: res.sales || [],
      }
    } catch { return null }
  }

  async getAllWithStats(): Promise<Array<Customer & { totalSales: number; totalPaid: number; totalRemaining: number; salesCount: number }>> {
    const customers = await this.getAll()
    return customers
  }
}

export const customerRepository = new CustomerRepository()
