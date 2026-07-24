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
  type: 'monthly' | 'production' | 'hourly'
  notes?: string
  // إعدادات الموظف بالساعة
  hourlyRate?: number          // سعر الساعة العادية
  overtimeRate?: number        // سعر الساعة الإضافية
  workStartTime?: string       // وقت بدء العمل (HH:MM)
  workHoursPerDay?: number     // عدد ساعات العمل اليومية المطلوبة
  // إعدادات المرتب الشهري
  monthlySalary?: number       // المرتب الشهري (للنوع monthly)
  createdAt: string
  updatedAt: string
}

export interface WorkerAttendance {
  id: string
  workerId: string
  date: string
  checkIn?: string
  checkOut?: string
  status: 'present' | 'absent' | 'leave'
  notes?: string
  // حقول محسوبة
  workHours?: number           // إجمالي ساعات العمل
  overtimeHours?: number       // ساعات إضافية
  lateMinutes?: number         // دقائق التأخير
  createdAt: string
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
  productId?: string        // ربط بالمنتج (اختياري)
  priceType?: 'wholesale' | 'half_wholesale' | 'retail' | 'custom'  // نوع السعر المستخدم
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
  materialId?: string        // ربط بالمادة الخام (اختياري - لو المشترى مادة خام)
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

// ====== الخزينة (Treasury) ======
export interface TreasuryTransaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'transfer'
  amount: number
  date: string
  description: string
  category?: string  // مصدر/وجهة الفلوس (مبيعات، مشتريات، مصاريف، سلف، إلخ)
  referenceType?: string  // sale, purchase, expense, workerAdvance, etc.
  referenceId?: string
  notes?: string
  createdAt: string
}

// ====== المخازن (Warehouses) ======
export interface Warehouse {
  id: string
  name: string
  type: 'raw_materials' | 'finished_goods' | 'general'
  location?: string
  notes?: string
  createdAt: string
}

export interface Material {
  id: string
  name: string
  unit: string  // متر، كجم، قطعة، إلخ
  warehouseId: string
  quantity: number
  unitCost: number  // متوسط التكلفة
  reorderLevel?: number  // حد إعادة الطلب
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface MaterialTransaction {
  id: string
  materialId: string
  warehouseId: string
  type: 'in' | 'out' | 'transfer' | 'adjustment'
  quantity: number
  unitCost?: number
  date: string
  reason: string  // شراء، استهلاك، تحويل، تسوية
  referenceType?: string  // purchase, production_order, etc.
  referenceId?: string
  notes?: string
  createdAt: string
}

// ====== المنتجات ======
export interface Product {
  id: string
  name: string
  category?: string
  unit: string  // قطعة، زوج، إلخ
  wholesalePrice: number     // سعر الجملة
  halfWholesalePrice: number // سعر نصف الجملة
  retailPrice: number        // سعر القطاعي
  cost: number               // التكلفة (محسوبة من المواد)
  warehouseId?: string       // مخزن المنتجات المنتهية
  quantity: number           // الكمية المتاحة
  reorderLevel?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

// ====== أوامر التشغيل (Production Orders) ======
export interface ProductionOrderItem {
  id: string
  materialId: string
  materialName: string
  quantity: number
  unit: string
}

export interface ProductionOrderStage {
  id: string
  name: string  // قص، خياطة، تشطيب، إلخ
  status: 'pending' | 'in_progress' | 'completed'
  startedAt?: string
  completedAt?: string
  workerId?: string
  notes?: string
}

export interface ProductionOrder {
  id: string
  orderNumber: string
  productId: string
  productName: string
  quantity: number  // الكمية المطلوب إنتاجها
  completedQuantity: number  // الكمية المنتهية
  unit: string
  status: 'draft' | 'in_progress' | 'completed' | 'cancelled'
  // المواد المستخدمة
  materials: ProductionOrderItem[]
  // مراحل التصنيع
  stages: ProductionOrderStage[]
  date: string
  expectedEndDate?: string
  completedDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// كل الجداول في قاعدة البيانات
export type TableName =
  | 'factorySettings'
  | 'auditLogs'
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
  | 'treasuryTransactions'
  | 'warehouses'
  | 'materials'
  | 'materialTransactions'
  | 'products'
  | 'productionOrders'

export interface DatabaseSchema {
  factorySettings: FactorySettings
  auditLogs: AuditLogEntry
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
  treasuryTransactions: TreasuryTransaction
  warehouses: Warehouse
  materials: Material
  materialTransactions: MaterialTransaction
  products: Product
  productionOrders: ProductionOrder
}

// إضافة AuditLogEntry type
export interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'backup' | 'restore'
  entityType: string
  entityId?: string
  description: string
  metadata?: Record<string, any>
  timestamp: string
}
