'use client'
import { BaseRepository } from './base'
import { apiGet, apiPost, apiDelete } from '../../api-client'
import { dataChangeEmitter } from '../live-data'
import type { Payment } from '../types'

class PaymentRepository extends BaseRepository<Payment> {
  constructor() { super('/api/payments', 'payments', 'payments') }

  async getByParty(partyId: string): Promise<Payment[]> {
    return this.getAll({ partyId })
  }

  async getByDateRange(from?: string, to?: string): Promise<Payment[]> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return this.getAll(params)
  }

  async getByType(type: 'customer_payment' | 'supplier_payment'): Promise<Payment[]> {
    return this.getAll({ type })
  }

  async create(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const res = await apiPost<any>('/api/payments', data)
    dataChangeEmitter.notifyCreate('payments')
    dataChangeEmitter.notifyUpdate('treasuryTransactions')
    if (data.type === 'customer_payment') {
      dataChangeEmitter.notifyUpdate('sales')
      dataChangeEmitter.notifyUpdate('customers')
    } else {
      dataChangeEmitter.notifyUpdate('purchases')
      dataChangeEmitter.notifyUpdate('suppliers')
    }
    return res.payment || res
  }

  async delete(id: string): Promise<void> {
    // We need to know the payment type to emit correct events
    // Fetch it first, then delete
    try {
      const payment = await this.getById(id)
      await apiDelete(`/api/payments/${id}`)
      dataChangeEmitter.notifyDelete('payments')
      dataChangeEmitter.notifyUpdate('treasuryTransactions')
      if (payment?.type === 'customer_payment') {
        dataChangeEmitter.notifyUpdate('sales')
        dataChangeEmitter.notifyUpdate('customers')
      } else {
        dataChangeEmitter.notifyUpdate('purchases')
        dataChangeEmitter.notifyUpdate('suppliers')
      }
    } catch { await apiDelete(`/api/payments/${id}`) }
  }
}

export const paymentRepository = new PaymentRepository()
