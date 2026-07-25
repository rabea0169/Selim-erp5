import {
  saleRepository,
  purchaseRepository,
  expenseRepository,
  workerAdvanceRepository,
  workerReceiptRepository,
  productionRepository,
  workerAttendanceRepository,
} from './index'
import { apiFetch } from '../api-client'
import type {
  Sale,
  Purchase,
  WorkerAdvance,
  WorkerReceipt,
  Production,
  WorkerAttendance,
  Expense,
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
    const [
      sales, purchases, expenses, advances, receipts, productions, attendance,
    ] = await Promise.all([
      saleRepository.getByDateRange(from, to),
      purchaseRepository.getByDateRange(from, to),
      expenseRepository.getByDateRange(from, to),
      workerAdvanceRepository.getByDateRange(from, to),
      workerReceiptRepository.getByDateRange(from, to),
      productionRepository.getByDateRange(from, to),
      workerAttendanceRepository.getByDateRange(from, to),
    ])

    const salesTotal = sales.reduce((s, x) => s + (x as any).total, 0)
    const salesPaid = sales.reduce((s, x) => s + (x as any).paid, 0)
    const purchasesTotal = purchases.reduce((s, x) => s + (x as any).total, 0)
    const purchasesPaid = purchases.reduce((s, x) => s + (x as any).paid, 0)
    const advancesTotal = advances.reduce((s, x) => s + (x as any).amount, 0)
    const receiptsTotal = receipts.reduce((s, x) => s + (x as any).amount, 0)
    const productionTotal = productions.reduce((s, x) => s + (x as any).total, 0)
    const productionPieces = productions.reduce((s, x) => s + (x as any).quantity, 0)
    const expensesTotal = expenses.reduce((s, x) => s + (x as any).amount, 0)

    const expensesByCategory: Record<string, number> = {}
    for (const e of expenses) {
      const exp = e as any
      expensesByCategory[exp.categoryName] = (expensesByCategory[exp.categoryName] || 0) + exp.amount
    }

    const itemAgg: Record<string, { qty: number; total: number }> = {}
    for (const s of sales) {
      const sale = s as any
      for (const it of (sale.items || [])) {
        if (!itemAgg[it.itemName]) itemAgg[it.itemName] = { qty: 0, total: 0 }
        itemAgg[it.itemName].qty += it.quantity
        itemAgg[it.itemName].total += it.total
      }
    }
    const topItems = Object.entries(itemAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const modelAgg: Record<string, { qty: number; total: number }> = {}
    for (const p of productions) {
      const prod = p as any
      if (!modelAgg[prod.modelName]) modelAgg[prod.modelName] = { qty: 0, total: 0 }
      modelAgg[prod.modelName].qty += prod.quantity
      modelAgg[prod.modelName].total += prod.total
    }
    const topModels = Object.entries(modelAgg)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    const netProfit =
      salesTotal - purchasesTotal - expensesTotal - advancesTotal + receiptsTotal - productionTotal

    return {
      range: { from, to },
      summary: {
        salesTotal, salesPaid, salesRemaining: salesTotal - salesPaid,
        purchasesTotal, purchasesPaid, purchasesRemaining: purchasesTotal - purchasesPaid,
        advancesTotal, receiptsTotal, productionTotal, productionPieces,
        expensesTotal, netProfit,
      },
      sales, purchases, advances, receipts, productions, attendance, expenses,
      expensesByCategory, topItems, topModels,
    }
  }

  // النسخ الاحتياطي يتم عبر API
  async exportAll(): Promise<any> {
    return apiFetch('/api/backup')
  }

  // الاسترجاع يتم عبر API
  async importAll(backupData: any): Promise<{ success: boolean; counts: any }> {
    return apiFetch<{ success: boolean; counts: any }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(backupData),
    })
  }
}

export const reportRepository = new ReportRepository()
