// أنواع البيانات لقاعدة البيانات المحلية

export interface FactorySettings {
  id: string // دائماً 'singleton'
  factoryName: string
  factoryNameEn?: string
  slogan?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  taxNumber?: string
  commercialRegister?: string
  logo?: string // base64 data URL
  currency: string
  // إعدادات الفواتير
  invoicePrefix?: string
  invoiceFooter?: string
  // إعدادات الطباعة
  defaultPaperSize?: string
  updatedAt: string
}

export interface User {
  id: string
  username: string
  passwordHash: string
  name: string
  role: 'admin' | 'user'
  createdAt: string
  updatedAt: string
}

export interface Worker {
  id: string
  name: string
  phone?: string
  job?: string
  type: 'monthly' | 'production'
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface WorkerAdvance {
  id: string
  workerId: string
  amount: number
  date: string
  notes?: string
  createdAt: string
}

export interface WorkerReceipt {
  id: string
  workerId: string
  amount: number
  date: string
  notes?: string
  createdAt: string
}

export interface WorkerAttendance {
  id: string
  workerId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'leave'
  notes?: string
  createdAt: string
}

export interface Production {
  id: string
  workerId: string
  date: string
  modelName: string
  quantity: number
  unitPrice: number
  total: number
  notes?: string
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  createdAt: string
}

export interface SaleItem {
  id: string
  saleId: string
  itemName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Sale {
  id: string
  invoiceNo?: string
  customerName: string
  customerId_ref?: string
  date: string
  total: number
  paid: number
  notes?: string
  items: SaleItem[]
  createdAt: string
  updatedAt: string
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  itemName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Purchase {
  id: string
  invoiceNo?: string
  supplierName: string
  supplierId_ref?: string
  date: string
  total: number
  paid: number
  notes?: string
  items: PurchaseItem[]
  createdAt: string
  updatedAt: string
}

export interface ExpenseCategory {
  id: string
  name: string
  notes?: string
  createdAt: string
}

export interface Expense {
  id: string
  categoryId: string
  categoryName: string
  amount: number
  date: string
  notes?: string
  createdAt: string
}

// كل الجداول في قاعدة البيانات
export type TableName =
  | 'factorySettings'
  | 'users'
  | 'workers'
  | 'workerAdvances'
  | 'workerReceipts'
  | 'workerAttendance'
  | 'production'
  | 'customers'
  | 'suppliers'
  | 'sales'
  | 'saleItems'
  | 'purchases'
  | 'purchaseItems'
  | 'expenseCategories'
  | 'expenses'

export interface DatabaseSchema {
  factorySettings: FactorySettings
  users: User
  workers: Worker
  workerAdvances: WorkerAdvance
  workerReceipts: WorkerReceipt
  workerAttendance: WorkerAttendance
  production: Production
  customers: Customer
  suppliers: Supplier
  sales: Sale
  saleItems: SaleItem
  purchases: Purchase
  purchaseItems: PurchaseItem
  expenseCategories: ExpenseCategory
  expenses: Expense
}
