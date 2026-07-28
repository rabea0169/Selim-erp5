'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Users, Wallet, HandCoins, FileText,
  X, AlertTriangle, Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
import {
  customerRepository, supplierRepository, purchaseRepository,
  paymentRepository, dataChangeEmitter, useLiveData,
  type Customer, type Supplier, type Sale, type Purchase, type Payment,
} from '@/lib/db'

// ============================================================
// أنواع البيانات
// ============================================================
interface CustomerDebt {
  customer: Customer
  totalSales: number
  totalPaid: number
  totalRemaining: number
  openingBalance: number
  totalDebt: number
  sales: Sale[]
}

interface SupplierDebt {
  supplier: Supplier
  totalPurchases: number
  totalPaid: number
  totalRemaining: number
  openingBalance: number
  totalDebt: number
  purchases: Purchase[]
}

interface TxRow {
  id: string
  date: string
  label: string
  debit: number
  credit: number
  balance: number
}

// ============================================================
// جلب ذمم العملاء
// ============================================================
async function fetchCustomerDebts(search: string): Promise<{ items: CustomerDebt[]; total: number }> {
  const raw = search
    ? await customerRepository.search(search)
    : await customerRepository.getAll()
  const customers: Customer[] = Array.isArray(raw) ? raw : (raw as any)?.customers ?? []

  const items: CustomerDebt[] = []
  for (const c of customers) {
    const stats = await customerRepository.getWithStats(c.id)
    if (!stats) continue
    const openingBalance = c.openingBalance || 0
    const totalDebt = stats.totalRemaining + openingBalance
    if (totalDebt <= 0) continue
    items.push({
      customer: c,
      totalSales: stats.totalSales,
      totalPaid: stats.totalPaid,
      totalRemaining: stats.totalRemaining,
      openingBalance,
      totalDebt,
      sales: stats.sales || [],
    })
  }
  items.sort((a, b) => b.totalDebt - a.totalDebt)
  return { items, total: items.reduce((s, x) => s + x.totalDebt, 0) }
}

// ============================================================
// جلب ذمم الموردين
// ============================================================
async function fetchSupplierDebts(search: string): Promise<{ items: SupplierDebt[]; total: number }> {
  const rawSupp = search
    ? await supplierRepository.search(search)
    : await supplierRepository.getAll()
  const suppliers: Supplier[] = Array.isArray(rawSupp) ? rawSupp : (rawSupp as any)?.suppliers ?? []

  const rawPurch = await purchaseRepository.getAll()
  const allPurchases: Purchase[] = Array.isArray(rawPurch) ? rawPurch : (rawPurch as any)?.purchases ?? []

  const items: SupplierDebt[] = []
  for (const s of suppliers) {
    const supPurchases = allPurchases.filter(
      (p) => (p as any).supplierId_ref === s.id || p.supplierName === s.name
    )
    const openingBalance = (s as any).openingBalance || 0
    const totalPurchases = supPurchases.reduce((sum, p) => sum + p.total, 0)
    const totalPaid = supPurchases.reduce((sum, p) => sum + p.paid, 0)
    const totalDebt = totalPurchases - totalPaid + openingBalance
    if (totalDebt <= 0) continue
    items.push({
      supplier: s,
      totalPurchases,
      totalPaid,
      totalRemaining: totalPurchases - totalPaid,
      openingBalance,
      totalDebt,
      purchases: supPurchases,
    })
  }
  items.sort((a, b) => b.totalDebt - a.totalDebt)
  return { items, total: items.reduce((s, x) => s + x.totalDebt, 0) }
}

// ============================================================
// الشاشة الرئيسية
// ============================================================
export function ReceivablesView({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers')
  const [search, setSearch] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDebt | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDebt | null>(null)

  const { data: custData, loading: custLoading, reload: reloadCust } = useLiveData(
    () => fetchCustomerDebts(search),
    ['customers', 'sales', 'payments']
  )
  const { data: suppData, loading: suppLoading, reload: reloadSupp } = useLiveData(
    () => fetchSupplierDebts(search),
    ['suppliers', 'purchases', 'payments']
  )

  useEffect(() => { reloadCust(); reloadSupp() }, [search, reloadCust, reloadSupp])

  const customers = custData?.items || []
  const suppliers = suppData?.items || []
  const custTotal = custData?.total || 0
  const suppTotal = suppData?.total || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
              <X className="w-4 h-4 ml-1" /> رجوع
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800">الذمم المالية</h2>
            <p className="text-xs text-slate-500">ديون العملاء وأرصدة الموردين</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-l from-rose-500 to-red-600 text-white rounded-xl p-3">
          <p className="text-[10px] opacity-90">ذمم العملاء</p>
          <p className="text-lg font-bold">{formatCurrency(custTotal)}</p>
          <p className="text-[10px] opacity-80">{customers.length} عميل مدين</p>
        </div>
        <div className="bg-gradient-to-l from-amber-500 to-orange-600 text-white rounded-xl p-3">
          <p className="text-[10px] opacity-90">مستحقات الموردين</p>
          <p className="text-lg font-bold">{formatCurrency(suppTotal)}</p>
          <p className="text-[10px] opacity-80">{suppliers.length} مورد له مستحقات</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'customers' | 'suppliers')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="customers">
            <Users className="w-3.5 h-3.5 ml-1" />
            العملاء ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            <Truck className="w-3.5 h-3.5 ml-1" />
            الموردين ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          {custLoading ? <LoadingSkeleton /> : customers.length === 0 ? (
            <EmptyState icon={<Users className="w-10 h-10 text-slate-300" />} text="لا توجد مديونيات للعملاء" />
          ) : (
            <div className="space-y-2 mt-2">
              {customers.map((item) => (
                <CustomerCard
                  key={item.customer.id}
                  item={item}
                  onPay={() => { setSelectedCustomer(item); setPaymentOpen(true) }}
                  onStatement={() => { setSelectedCustomer(item); setStatementOpen(true) }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suppliers">
          {suppLoading ? <LoadingSkeleton /> : suppliers.length === 0 ? (
            <EmptyState icon={<Truck className="w-10 h-10 text-slate-300" />} text="لا توجد مستحقات للموردين" />
          ) : (
            <div className="space-y-2 mt-2">
              {suppliers.map((item) => (
                <SupplierCard
                  key={item.supplier.id}
                  item={item}
                  onPay={() => { setSelectedSupplier(item); setPaymentOpen(true) }}
                  onStatement={() => { setSelectedSupplier(item); setStatementOpen(true) }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedCustomer && tab === 'customers' && (
        <>
          <CustomerPaymentDialog
            open={paymentOpen}
            onOpenChange={(v) => { setPaymentOpen(v); if (!v) reloadCust() }}
            item={selectedCustomer}
          />
          <CustomerStatementDialog
            open={statementOpen}
            onOpenChange={setStatementOpen}
            item={selectedCustomer}
          />
        </>
      )}

      {selectedSupplier && tab === 'suppliers' && (
        <>
          <SupplierPaymentDialog
            open={paymentOpen}
            onOpenChange={(v) => { setPaymentOpen(v); if (!v) reloadSupp() }}
            item={selectedSupplier}
          />
          <SupplierStatementDialog
            open={statementOpen}
            onOpenChange={setStatementOpen}
            item={selectedSupplier}
          />
        </>
      )}
    </div>
  )
}

// ============================================================
// مكوّنات مساعدة
// ============================================================
function LoadingSkeleton() {
  return (
    <div className="space-y-2 mt-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />)}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white rounded-xl p-8 text-center border border-slate-100 mt-2">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

function CustomerCard({ item, onPay, onStatement }: { item: CustomerDebt; onPay: () => void; onStatement: () => void }) {
  const overLimit = item.customer.creditLimit && item.customer.creditLimit > 0 && item.totalDebt > item.customer.creditLimit
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
            {item.customer.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{item.customer.name}</p>
            {item.customer.phone && <p className="text-[11px] text-slate-500">{item.customer.phone}</p>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200" onClick={onStatement}>
            <FileText className="w-3.5 h-3.5 ml-1" /> كشف
          </Button>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onPay}>
            <HandCoins className="w-3.5 h-3.5 ml-1" /> تحصيل
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-emerald-700">المبيعات</p>
          <p className="font-bold text-emerald-900">{formatCurrency(item.totalSales)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-blue-700">المحصّل</p>
          <p className="font-bold text-blue-900">{formatCurrency(item.totalPaid)}</p>
        </div>
        <div className="bg-rose-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-rose-700">المتبقي</p>
          <p className="font-bold text-rose-900">{formatCurrency(item.totalDebt)}</p>
        </div>
      </div>
      {overLimit && (
        <div className="mt-2 flex items-center gap-1.5 bg-rose-100 text-rose-700 text-[11px] rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3" />
          <span>تجاوز حد الائتمان ({formatCurrency(item.customer.creditLimit || 0)})</span>
        </div>
      )}
    </div>
  )
}

function SupplierCard({ item, onPay, onStatement }: { item: SupplierDebt; onPay: () => void; onStatement: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
            {item.supplier.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{item.supplier.name}</p>
            {item.supplier.phone && <p className="text-[11px] text-slate-500">{item.supplier.phone}</p>}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200" onClick={onStatement}>
            <FileText className="w-3.5 h-3.5 ml-1" /> كشف
          </Button>
          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={onPay}>
            <Wallet className="w-3.5 h-3.5 ml-1" /> سداد
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-amber-700">المشتريات</p>
          <p className="font-bold text-amber-900">{formatCurrency(item.totalPurchases)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-blue-700">المدفوع</p>
          <p className="font-bold text-blue-900">{formatCurrency(item.totalPaid)}</p>
        </div>
        <div className="bg-rose-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-rose-700">المستحق</p>
          <p className="font-bold text-rose-900">{formatCurrency(item.totalDebt)}</p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// نافذة تحصيل من عميل
// ============================================================
function CustomerPaymentDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: CustomerDebt }) {
  const [invoiceId, setInvoiceId] = useState('__none__')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const unpaidInvoices = useMemo(() => item.sales.filter((s) => s.paid < s.total), [item])

  useEffect(() => {
    if (open) { setInvoiceId('__none__'); setAmount(''); setMethod('cash'); setDate(todayStr()); setNotes('') }
  }, [open])

  const save = async () => {
    const amt = Number(amount)
    if (amt <= 0) { toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const inv = invoiceId !== '__none__' ? item.sales.find((s) => s.id === invoiceId) : undefined
      await paymentRepository.create({
        type: 'customer_payment',
        partyId: item.customer.id,
        partyName: item.customer.name,
        invoiceId: inv?.id,
        invoiceNo: inv?.invoiceNo,
        amount: amt,
        date,
        method,
        notes: notes || undefined,
      })
      toast({ title: 'تم', description: `تم تسجيل تحصيل ${formatCurrency(amt)} من ${item.customer.name}` })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 bg-slate-300 rounded-full" /></div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-emerald-600" />
            تحصيل من: {item.customer.name}
          </DialogTitle>
          <DialogDescription className="sr-only">تسجيل تحصيل دفعة من العميل</DialogDescription>
        </DialogHeader>
        <SharedPaymentForm
          totalDebt={item.totalDebt} debtLabel="إجمالي المديونية" debtBg="bg-rose-50" debtText="text-rose-700" debtValue="text-rose-900"
          invoices={unpaidInvoices.map((s) => ({ id: s.id, label: `${s.invoiceNo || formatDate(s.date)} — متبقي ${formatCurrency(s.total - s.paid)}` }))}
          invoiceId={invoiceId} onInvoiceChange={setInvoiceId}
          amount={amount} onAmountChange={setAmount}
          method={method} onMethodChange={setMethod}
          date={date} onDateChange={setDate}
          notes={notes} onNotesChange={setNotes}
          saving={saving} onSave={save} onCancel={() => onOpenChange(false)}
          btnLabel="تسجيل التحصيل" btnClass="bg-emerald-600 hover:bg-emerald-700"
        />
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// نافذة سداد لمورد
// ============================================================
function SupplierPaymentDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: SupplierDebt }) {
  const [invoiceId, setInvoiceId] = useState('__none__')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const unpaidInvoices = useMemo(() => item.purchases.filter((p) => p.paid < p.total), [item])

  useEffect(() => {
    if (open) { setInvoiceId('__none__'); setAmount(''); setMethod('cash'); setDate(todayStr()); setNotes('') }
  }, [open])

  const save = async () => {
    const amt = Number(amount)
    if (amt <= 0) { toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const inv = invoiceId !== '__none__' ? item.purchases.find((p) => p.id === invoiceId) : undefined
      await paymentRepository.create({
        type: 'supplier_payment',
        partyId: item.supplier.id,
        partyName: item.supplier.name,
        invoiceId: inv?.id,
        invoiceNo: inv?.invoiceNo,
        amount: amt,
        date,
        method,
        notes: notes || undefined,
      })
      toast({ title: 'تم', description: `تم تسجيل سداد ${formatCurrency(amt)} للمورد ${item.supplier.name}` })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 bg-slate-300 rounded-full" /></div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-600" />
            سداد لـ: {item.supplier.name}
          </DialogTitle>
          <DialogDescription className="sr-only">تسجيل سداد دفعة للمورد</DialogDescription>
        </DialogHeader>
        <SharedPaymentForm
          totalDebt={item.totalDebt} debtLabel="إجمالي المستحق" debtBg="bg-amber-50" debtText="text-amber-700" debtValue="text-amber-900"
          invoices={unpaidInvoices.map((p) => ({ id: p.id, label: `${p.invoiceNo || formatDate(p.date)} — متبقي ${formatCurrency(p.total - p.paid)}` }))}
          invoiceId={invoiceId} onInvoiceChange={setInvoiceId}
          amount={amount} onAmountChange={setAmount}
          method={method} onMethodChange={setMethod}
          date={date} onDateChange={setDate}
          notes={notes} onNotesChange={setNotes}
          saving={saving} onSave={save} onCancel={() => onOpenChange(false)}
          btnLabel="تسجيل السداد" btnClass="bg-amber-600 hover:bg-amber-700"
        />
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// فورم الدفع/التحصيل المشترك
// ============================================================
interface SharedPaymentFormProps {
  totalDebt: number; debtLabel: string; debtBg: string; debtText: string; debtValue: string
  invoices: { id: string; label: string }[]
  invoiceId: string; onInvoiceChange: (v: string) => void
  amount: string; onAmountChange: (v: string) => void
  method: 'cash' | 'transfer' | 'card'; onMethodChange: (v: 'cash' | 'transfer' | 'card') => void
  date: string; onDateChange: (v: string) => void
  notes: string; onNotesChange: (v: string) => void
  saving: boolean; onSave: () => void; onCancel: () => void
  btnLabel: string; btnClass: string
}

function SharedPaymentForm({ totalDebt, debtLabel, debtBg, debtText, debtValue, invoices, invoiceId, onInvoiceChange, amount, onAmountChange, method, onMethodChange, date, onDateChange, notes, onNotesChange, saving, onSave, onCancel, btnLabel, btnClass }: SharedPaymentFormProps) {
  return (
    <>
      <div className="space-y-3 px-1 pb-2">
        <div className={`${debtBg} rounded-lg p-2 text-center`}>
          <p className={`text-[10px] ${debtText}`}>{debtLabel}</p>
          <p className={`text-lg font-bold ${debtValue}`}>{formatCurrency(totalDebt)}</p>
        </div>
        {invoices.length > 0 && (
          <div>
            <Label className="text-xs">الفاتورة (اختياري)</Label>
            <Select value={invoiceId} onValueChange={onInvoiceChange}>
              <SelectTrigger className="bg-slate-50"><SelectValue placeholder="سداد عام" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— سداد عام —</SelectItem>
                {invoices.map((inv) => <SelectItem key={inv.id} value={inv.id}>{inv.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-xs">المبلغ *</Label>
          <Input type="number" value={amount} onChange={(e) => onAmountChange(e.target.value)} placeholder="0" className="bg-slate-50" min="0" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">طريقة الدفع</Label>
            <Select value={method} onValueChange={onMethodChange}>
              <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">كاش</SelectItem>
                <SelectItem value="transfer">تحويل بنكي</SelectItem>
                <SelectItem value="card">بطاقة</SelectItem>
                <SelectItem value="check">شيك</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} className="bg-slate-50" />
          </div>
        </div>
        <div>
          <Label className="text-xs">ملاحظات</Label>
          <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="ملاحظات..." className="bg-slate-50 text-sm" rows={2} />
        </div>
      </div>
      <DialogFooter className="gap-2 px-1 pb-6">
        <Button variant="outline" onClick={onCancel} disabled={saving}>إلغاء</Button>
        <Button onClick={onSave} disabled={saving} className={`text-white ${btnClass}`}>
          {saving ? 'جارٍ الحفظ...' : btnLabel}
        </Button>
      </DialogFooter>
    </>
  )
}

// ============================================================
// كشف حساب عميل
// ============================================================
function CustomerStatementDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: CustomerDebt }) {
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (open) {
      paymentRepository.getByParty(item.customer.id).then(setPayments).catch(() => setPayments([]))
    }
  }, [open, item.customer.id])

  const rows = buildTxRows(
    item.sales.map((s) => ({ id: s.id, date: s.date, label: `فاتورة${s.invoiceNo ? ' ' + s.invoiceNo : ''}`, debit: s.total, credit: 0 })),
    payments.map((p) => ({ id: p.id, date: p.date, label: `تحصيل${p.method ? ' (' + p.method + ')' : ''}`, debit: 0, credit: p.amount })),
    item.openingBalance
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 bg-slate-300 rounded-full" /></div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            كشف حساب: {item.customer.name}
          </DialogTitle>
          <DialogDescription className="sr-only">كشف حساب تفصيلي</DialogDescription>
        </DialogHeader>
        <StatementTable rows={rows} openingBalance={item.openingBalance} finalBalance={item.totalDebt} />
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// كشف حساب مورد
// ============================================================
function SupplierStatementDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: SupplierDebt }) {
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (open) {
      paymentRepository.getByParty(item.supplier.id).then(setPayments).catch(() => setPayments([]))
    }
  }, [open, item.supplier.id])

  const rows = buildTxRows(
    item.purchases.map((p) => ({ id: p.id, date: p.date, label: `فاتورة شراء${p.invoiceNo ? ' ' + p.invoiceNo : ''}`, debit: p.total, credit: 0 })),
    payments.map((p) => ({ id: p.id, date: p.date, label: `سداد${p.method ? ' (' + p.method + ')' : ''}`, debit: 0, credit: p.amount })),
    item.openingBalance
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2"><div className="w-12 h-1 bg-slate-300 rounded-full" /></div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            كشف حساب: {item.supplier.name}
          </DialogTitle>
          <DialogDescription className="sr-only">كشف حساب تفصيلي للمورد</DialogDescription>
        </DialogHeader>
        <StatementTable rows={rows} openingBalance={item.openingBalance} finalBalance={item.totalDebt} />
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// دوال مساعدة وجداول
// ============================================================
function buildTxRows(
  debits: { id: string; date: string; label: string; debit: number; credit: number }[],
  credits: { id: string; date: string; label: string; debit: number; credit: number }[],
  openingBalance: number
): TxRow[] {
  const all = [...debits, ...credits].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  let balance = openingBalance
  return all.map((t) => {
    balance += t.debit - t.credit
    return { ...t, balance }
  })
}

function StatementTable({ rows, openingBalance, finalBalance }: { rows: TxRow[]; openingBalance: number; finalBalance: number }) {
  return (
    <div className="space-y-3 px-1 pb-6">
      {openingBalance > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded p-2 text-xs text-amber-800 flex justify-between">
          <span>رصيد افتتاحي</span>
          <span className="font-bold">{formatCurrency(openingBalance)}</span>
        </div>
      )}
      <div className="bg-white border border-slate-100 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-center text-xs text-slate-500 p-4">لا توجد معاملات</p>
        ) : rows.map((t, i) => (
          <div key={i} className="flex items-start justify-between p-2 border-b border-slate-50 text-xs last:border-0">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[9px] ${t.debit > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                  {t.debit > 0 ? 'مدين' : 'دائن'}
                </Badge>
                <span className="text-slate-500">{formatDate(t.date)}</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{t.label}</p>
            </div>
            <div className="text-left flex flex-col items-end gap-0.5">
              {t.debit > 0 && <span className="font-bold text-rose-700">+{formatCurrency(t.debit)}</span>}
              {t.credit > 0 && <span className="font-bold text-emerald-700">-{formatCurrency(t.credit)}</span>}
              <span className="text-[10px] text-slate-400">رصيد: {formatCurrency(t.balance)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-slate-800 text-white rounded-lg p-3 flex justify-between items-center">
        <span className="text-sm">الرصيد الحالي</span>
        <span className="text-lg font-bold">{formatCurrency(finalBalance)}</span>
      </div>
    </div>
  )
}
