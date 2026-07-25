import os

db_path = '/home/z/my-project/selim-check/src/lib/db.ts'

content = '''// ====== Client-Side Data Layer for Selim ERP ======
'use client'

import { useState, useEffect, useCallback } from 'react'

// ====== Types ======

export interface SessionUser {
  id: string
  username: string
  name: string
  role: string
  phone?: string
  companyId: string
}

export interface SaleItem {
  id: string; saleId: string; itemName: string; productId?: string
  priceType?: string; quantity: number; unitPrice: number; total: number
}

export interface Sale {
  id: string; invoiceNo?: string; customerName: string; customerId_ref?: string
  date: string; subtotal: number; discountType?: string; discountValue?: number
  discountAmount?: number; taxRate?: number; taxAmount?: number; extraFees?: number
  total: number; paid: number; notes?: string; createdAt: string
  updatedAt?: string; items: SaleItem[]
}

export interface PurchaseItem {
  id: string; purchaseId: string; itemName: string; materialId?: string
  quantity: number; unitPrice: number; total: number
}

export interface Purchase {
  id: string; invoiceNo?: string; supplierName: string; supplierId_ref?: string
  date: string; subtotal: number; discountType?: string; discountValue?: number
  discountAmount?: number; taxRate?: number; taxAmount?: number; extraFees?: number
  total: number; paid: number; notes?: string; createdAt: string
  updatedAt?: string; items: PurchaseItem[]
}

export interface Worker {
  id: string; name: string; phone?: string; job?: string; type: string
  hourlyRate?: number; overtimeRate?: number; workStartTime?: string
  workHoursPerDay?: number; monthlySalary?: number; notes?: string
  createdAt: string; updatedAt: string
}

export interface Customer {
  id: string; name: string; phone?: string; address?: string; notes?: string
  creditLimit?: number; loyaltyPoints: number; openingBalance: number; createdAt: string
}

export interface Supplier {
  id: string; name: string; phone?: string; address?: string; notes?: string
  creditLimit?: number; openingBalance: number; createdAt: string
}

export interface Expense {
  id: string; categoryId: string; categoryName: string; amount: number
  date: string; notes?: string; createdAt: string
}

export interface ExpenseCategory {
  id: string; name: string; notes?: string; createdAt: string
}

export interface Product {
  id: string; name: string; category?: string; unit: string
  wholesalePrice: number; halfWholesalePrice: number; retailPrice: number
  cost: number; warehouseId?: string; quantity: number; reorderLevel?: number
  notes?: string; createdAt: string; updatedAt: string
}

export interface Warehouse {
  id: string; name: string; type: string; location?: string
  notes?: string; createdAt: string
}

export interface Material {
  id: string; name: string; unit: string; warehouseId: string
  quantity: number; unitCost: number; reorderLevel?: number
  notes?: string; createdAt: string; updatedAt: string
}

export interface TreasuryTransaction {
  id: string; type: string; amount: number; date: string
  description: string; category?: string; referenceType?: string
  referenceId?: string; notes?: string; createdAt: string
}

export interface ProductionOrder {
  id: string; orderNumber: string; productId: string; productName: string
  quantity: number; completedQuantity: number; unit: string; status: string
  materials: any; stages: any; date: string; expectedEndDate?: string
  completedDate?: string; notes?: string; createdAt: string; updatedAt: string
}

export interface FactorySettings {
  id: string; factoryName: string; factoryNameEn?: string; slogan?: string
  phone?: string; whatsapp?: string; email?: string; address?: string
  taxNumber?: string; commercialRegister?: string; logo?: string
  currency: string; invoicePrefix?: string; invoiceFooter?: string
  defaultPaperSize?: string; taxRate?: number; updatedAt: string
}

export interface WorkerAttendance {
  id: string; workerId: string; date: string; checkIn?: string
  checkOut?: string; status: string; notes?: string; workHours?: number
  overtimeHours?: number; lateMinutes?: number; createdAt: string
}

export interface WorkerAdvance {
  id: string; workerId: string; amount: number; date: string
  notes?: string; createdAt: string
}

export interface WorkerReceipt {
  id: string; workerId: string; amount: number; date: string
  notes?: string; createdAt: string
}

export interface Production {
  id: string; workerId: string; date: string; modelName: string
  quantity: number; unitPrice: number; total: number; notes?: string; createdAt: string
}

export interface Payment {
  id: string; type: string; partyId: string; partyName: string
  invoiceId?: string; invoiceNo?: string; amount: number; date: string
  method?: string; notes?: string; createdAt: string
}

export interface SaleReturn {
  id: string; returnNumber: string; saleId: string; invoiceNo?: string
  customerName: string; customerId_ref?: string; date: string; total: number
  reason?: string; restockItems: boolean; items: any; notes?: string; createdAt: string
}

export interface PurchaseReturn {
  id: string; returnNumber: string; purchaseId: string; invoiceNo?: string
  supplierName: string; supplierId_ref?: string; date: string; total: number
  reason?: string; items: any; notes?: string; createdAt: string
}

export interface SearchResult {
  type: string; title: string; subtitle: string; amount?: number; icon: string
}

// ====== Auth ======

const SESSION_KEY = 'session_user'

export function getCurrentUser(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem(SESSION_KEY)
    if (!data) return null
    return JSON.parse(data)
  } catch {
    return null
  }
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  localStorage.setItem(SESSION_KEY, JSON.stringify(data.user))
  return data.user
}

export async function register(info: {
  username: string; password: string; name: string; phone?: string
  role: string; securityQuestion?: string; securityAnswer?: string
}): Promise<SessionUser> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(info),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
 return data.user
}

export function logout(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}

// ====== Data Change Emitter ======

type ChangeCallback = (entityType: string) => void

class DataChangeEmitter {
  private listeners: ChangeCallback[] = []
  subscribe(cb: ChangeCallback) {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }
  emit(entityType: string) { this.listeners.forEach(cb => cb(entityType)) }
  notifyCreate(t: string) { this.emit(t) }
  notifyUpdate(t: string) { this.emit(t) }
  notifyDelete(t: string) { this.emit(t) }
}

export const dataChangeEmitter = new DataChangeEmitter()

// ====== useLiveData Hook ======

export function useLiveData<T>(
  fetcher: () => Promise<T>,
  deps: string[] = []
): { data: T | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetcher()
      setData(result)
    } catch (e) {
      console.error('useLiveData error:', e)
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const unsub = dataChangeEmitter.subscribe(() => reload())
    return unsub
  }, [reload])

  return { data, loading, reload }
}

// ====== API Helper ======

async function api<T = any>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ====== Generic Repository ======

function repo<T>(base: string) {
  return {
    getAll: () => api<T[]>(base),
    search: (q?: string, from?: string, to?: string) => {
      const p = new URLSearchParams()
      if (q) p.set('q', q)
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      return api<T[]>(`${base}${p.toString() ? '?' + p : ''}`)
    },
    getById: (id: string) => api<T>(`${base}/${id}`),
    create: (d: any) => api<T>(base, { method: 'POST', body: JSON.stringify(d) }),
    update: (id: string, d: any) => api<T>(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete: (id: string) => api<{ success: boolean }>(`${base}/${id}`, { method: 'DELETE' }),
  }
}

// ====== Repositories ======

export const saleRepository = repo<Sale>('/api/sales')
export const purchaseRepository = repo<Purchase>('/api/purchases')
export const workerRepository = repo<Worker>('/api/workers')
export const customerRepository = repo<Customer>('/api/customers')
export const supplierRepository = repo<Supplier>('/api/suppliers')
export const expenseRepository = repo<Expense>('/api/expenses')
export const productRepository = repo<Product>('/api/products')
export const warehouseRepository = repo<Warehouse>('/api/warehouses')
export const materialRepository = repo<Material>('/api/materials')
export const treasuryRepository = repo<TreasuryTransaction>('/api/treasury')
export const productionOrderRepository = repo<ProductionOrder>('/api/production-orders')
export const attendanceRepository = repo<WorkerAttendance>('/api/attendance')
export const workerAdvanceRepository = repo<WorkerAdvance>('/api/worker-advances')
export const workerReceiptRepository = repo<WorkerReceipt>('/api/worker-receipts')
export const productionRepository = repo<Production>('/api/production')

// ====== Specialized Repositories ======

export const factorySettingsRepository = {
  get: () => api.get<FactorySettings>('/api/seed').then((d: any) => d.settings || d),
  update: (data: Partial<FactorySettings>) =>
    api<FactorySettings>('/api/seed', { method: 'PUT', body: JSON.stringify(data) }),
}

export const expenseCategoryRepository = {
  getAll: () => api<ExpenseCategory[]>('/api/expense-categories'),
  create: (data: { name: string; notes?: string }) =>
    api<ExpenseCategory>('/api/expense-categories', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) =>
    api<{ success: boolean }>(`/api/expense-categories/${id}`, { method: 'DELETE' }),
  seedDefaults: async () => {
    try { await api('/api/expense-categories/seed', { method: 'POST' }) } catch {}
  },
}

export const auditLogRepository = {
  log: (data: { userId: string; userName: string; action: string; entityType: string; description: string }) => {
    try { api('/api/audit', { method: 'POST', body: JSON.stringify(data) }).catch(() => {}) } catch {}
  },
}

// ====== Auto Backup Service ======

export const autoBackupService = {
  _timer: null as ReturnType<typeof setInterval> | null,
  start() {
    if (this._timer) return
    this._timer = setInterval(() => {
      try {
        const u = getCurrentUser()
        if (!u) return
        fetch('/api/backup', { method: 'POST' }).catch(() => {})
      } catch {}
    }, 30 * 60 * 1000)
  },
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },
}

// ====== Sync Service ======

export const syncService = {
  _timer: null as ReturnType<typeof setInterval> | null,
  start() {
    if (this._timer) return
    this._timer = setInterval(() => dataChangeEmitter.emit('sync'), 60 * 1000)
  },
  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null }
  },
}

// ====== Global Search ======

const SEARCH_ICONS: Record<string, string> = {
  sale: '🧾', purchase: '📦', worker: '👷', customer: '👤',
  supplier: '🚚', expense: '💸', product: '🏷️',
}

export const globalSearchService = {
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    if (query.length < 2) return results
    try {
      const sales = await saleRepository.search(query)
      sales.slice(0, 3).forEach((s: Sale) => {
        results.push({ type: 'sale', title: s.customerName, subtitle: s.invoiceNo || `فاتورة #${s.id.slice(-4)}`, amount: s.total, icon: SEARCH_ICONS.sale })
      })
    } catch {}
    try {
      const workers = await workerRepository.search(query)
      workers.slice(0, 3).forEach((w: Worker) => {
        results.push({ type: 'worker', title: w.name, subtitle: w.job || 'موظف', icon: SEARCH_ICONS.worker })
      })
    } catch {}
    try {
      const customers = await customerRepository.search(query)
      customers.slice(0, 3).forEach((c: Customer) => {
        results.push({ type: 'customer', title: c.name, subtitle: c.phone || 'عميل', icon: SEARCH_ICONS.customer })
      })
    } catch {}
    try {
      const purchases = await purchaseRepository.search(query)
      purchases.slice(0, 3).forEach((p: Purchase) => {
        results.push({ type: 'purchase', title: p.supplierName, subtitle: p.invoiceNo || `فاتورة #${p.id.slice(-4)}`, amount: p.total, icon: SEARCH_ICONS.purchase })
      })
    } catch {}
    return results
  },
}
'''

with open(db_path, 'w') as f:
    f.write(content)
print(f'Created db.ts: {os.path.getsize(db_path)} bytes')
