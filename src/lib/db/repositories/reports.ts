'use client'
import { apiGet } from '../../api-client'
import type {
  Sale, Purchase, WorkerAdvance, WorkerReceipt,
  Production, WorkerAttendance, Expense,
} from '../types'

export interface ReportSummary {
  salesTotal: number
  salesPaid: number
  salesRemaining: number
  purchasesTotal: number
  purchasesPaid: number
  purchasesRemaining: number
  advancesTotal: number
  receiptsTotal: number
  productionTotal: number
  productionPieces: number
  expensesTotal: number
  saleReturnsTotal: number
  purchaseReturnsTotal: number
  netProfit: number
}

export interface ReportData {
  range: { from?: string; to?: string }
  summary: ReportSummary
  sales: Sale[]
  purchases: Purchase[]
  advances: WorkerAdvance[]
  receipts: WorkerReceipt[]
  productions: Production[]
  attendance: WorkerAttendance[]
  expenses: Expense[]
  expensesByCategory: Record<string, number>
  topItems: Array<{ name: string; qty: number; total: number }>
  topModels: Array<{ name: string; qty: number; total: number }>
}

class ReportRepository {
  async getFullReport(from?: string, to?: string): Promise<ReportData> {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    const res = await apiGet<any>('/api/reports', params)
    // Server returns aggregated data — fill raw arrays as empty
    return {
      range: res.range || { from, to },
      summary: res.summary,
      sales: [],
      purchases: [],
      advances: [],
      receipts: [],
      productions: [],
      attendance: [],
      expenses: [],
      expensesByCategory: res.expensesByCategory || {},
      topItems: res.topItems || [],
      topModels: res.topModels || [],
    }
  }

  async exportAll(): Promise<any> {
    const res = await apiGet<any>('/api/backup')
    return res
  }

  async importAll(backupData: any): Promise<{ success: boolean; counts: any }> {
    const { apiPost } = await import('../../api-client')
    return await apiPost('/api/restore', { ...backupData, confirm: 'WIPE_AND_RESTORE' })
  }
}

export const reportRepository = new ReportRepository()
