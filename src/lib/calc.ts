// دوال حسابية نقية لوحدتي المخازن والمحاسبة — قابلة للاختبار الوحدوي (Unit Tested)
// تُستخدم في: sales, purchases, sale-returns, purchase-returns, customer-report, treasury

export interface InvoiceItemInput {
  quantity: number | string
  unitPrice: number | string
}

export interface InvoiceTotalsInput {
  items: InvoiceItemInput[]
  discountType?: string | null
  discountValue?: number | string | null
  taxRate?: number | string | null
  extraFees?: number | string | null
}

export interface InvoiceTotals {
  subtotal: number
  discountType: string | null
  discountValue: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  extraFees: number
  total: number
}

/**
 * حساب إجماليات الفاتورة (مبيعات/مشتريات):
 * subtotal = Σ(quantity × unitPrice)
 * الخصم: نسبة مئوية من subtotal أو مبلغ ثابت
 * الضريبة: تُحسب على (subtotal - الخصم)
 * total = subtotal - الخصم + الضريبة + الرسوم الإضافية
 */
export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = input.items.reduce(
    (sum, it) => sum + Number(it.quantity) * Number(it.unitPrice),
    0
  )
  const discountType = input.discountType || null
  const discountValue = Number(input.discountValue) || 0
  const discountAmount =
    discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue
  const taxRate = Number(input.taxRate) || 0
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
  const extraFees = Number(input.extraFees) || 0
  const total = subtotal - discountAmount + taxAmount + extraFees

  return { subtotal, discountType, discountValue, discountAmount, taxRate, taxAmount, extraFees, total }
}

/**
 * التحقق من صحة المبلغ المدفوع — يعيد رسالة خطأ عربية أو null إذا كان صحيحاً
 */
export function assertValidPaid(paidAmount: number, total: number): string | null {
  if (paidAmount < 0) {
    return 'المبلغ المدفوع لا يمكن أن يكون سالباً'
  }
  if (paidAmount > total) {
    return `المبلغ المدفوع (${paidAmount}) يتجاوز إجمالي الفاتورة (${total})`
  }
  return null
}

/**
 * متوسط التكلفة المرجح (Weighted Average Cost) لمخزون المواد الخام:
 * newCost = (القيمة القديمة + قيمة المشتريات الجديدة) / الكمية الجديدة الكلية
 * إذا كانت الكمية الكلية صفراً (حالة حدّية) → يعتمد سعر الشراء الجديد
 */
export function weightedAverageCost(
  oldQuantity: number,
  oldUnitCost: number,
  addedQuantity: number,
  addedUnitPrice: number
): number {
  const totalOldValue = oldQuantity * oldUnitCost
  const totalNewValue = addedQuantity * addedUnitPrice
  const newQuantity = oldQuantity + addedQuantity
  return newQuantity > 0 ? (totalOldValue + totalNewValue) / newQuantity : addedUnitPrice
}

export interface TreasuryEntry {
  type: 'deposit' | 'withdrawal' | 'transfer'
  amount: number | string
}

/**
 * رصيد الخزينة = مجموع الإيداعات - مجموع السحوبات
 */
export function treasuryBalance(transactions: TreasuryEntry[]): number {
  return transactions.reduce((balance, t) => {
    const amount = Number(t.amount) || 0
    return t.type === 'deposit' ? balance + amount : balance - amount
  }, 0)
}

/**
 * المتبقي على عميل/مورد = إجمالي الفواتير - المدفوع - المرتجعات (لا يقل عن صفر)
 */
export function partyOutstanding(
  totalInvoices: number,
  totalPaid: number,
  totalReturns: number
): number {
  return Math.max(0, totalInvoices - totalPaid - totalReturns)
}
