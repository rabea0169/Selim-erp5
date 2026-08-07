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

  async getWithStats(customerId: string): Promise<{ customer: Customer; totalSales: number; totalPaid: number; totalReturns: number; standalonePayments: number; totalRemaining: number; salesCount: number; sales: Sale[]; returns: any[]; payments: any[] } | null> {
    try {
      const res = await apiGet<any>(`/api/customer-report/${customerId}`)
      // العقد الفعلي للسيرفر: { customer, range, summary: { totalSales, totalPaid, totalRemaining, standalonePayments, ... }, sales, returns, payments }
      const summary = res.summary || {}
      return {
        customer: res.customer,
        totalSales: summary.totalSales || 0,
        totalPaid: summary.totalPaid || 0,
        totalReturns: summary.totalReturns || 0,
        standalonePayments: summary.standalonePayments || 0,
        totalRemaining: summary.totalRemaining || 0,
        salesCount: summary.salesCount ?? (res.sales || []).length,
        sales: res.sales || [],
        returns: res.returns || [],
        payments: res.payments || [],
      }
    } catch { return null }
  }

  async getAllWithStats(): Promise<Array<Customer & { totalSales: number; totalPaid: number; totalRemaining: number; salesCount: number }>> {
    const customers = await this.getAll()
    return customers
  }
}

export const customerRepository = new CustomerRepository()
