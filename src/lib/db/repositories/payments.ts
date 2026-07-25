import { BaseRepository } from './base'
import { dataChangeEmitter } from '../live-data'
import type { Payment } from '../types'

class PaymentRepository extends BaseRepository<Payment> {
  constructor() {
    // payments ليس لها API route خاصة حالياً - نستخدم GET/POST/PUT/DELETE
    // لكنها ليست في API_MAP، لذلك نحدد المسار يدوياً
    super('payments', '/api/payments', 'payments', 'payment')
  }

  async getByParty(partyId: string): Promise<Payment[]> {
    const all = await this.getAll()
    return all
      .filter((p) => p.partyId === partyId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByType(type: string): Promise<Payment[]> {
    const all = await this.getAll()
    return all
      .filter((p) => p.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  async getByDateRange(from?: string, to?: string): Promise<Payment[]> {
    return super.search(undefined, from, to)
  }

  // إنشاء سداد عبر API
  async create(data: any): Promise<Payment> {
    const result = await super.create(data)
    dataChangeEmitter.notifyCreate('payments')
    return result
  }

  async delete(id: string): Promise<void> {
    await super.delete(id)
    dataChangeEmitter.notifyDelete('payments')
  }
}

export const paymentRepository = new PaymentRepository()
