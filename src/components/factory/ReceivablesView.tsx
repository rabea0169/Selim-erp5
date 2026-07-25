'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Users,
  Wallet,
  HandCoins,
  FileText,
  X,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, formatDateTime, todayStr } from '@/lib/format'
import {
  customerRepository,
  paymentRepository,
  dataChangeEmitter,
  useLiveData,
  type Customer,
  type Sale,
  type Payment,
  getCurrentUser,
} from '@/lib/db'

interface ReceivableViewItem {
  customer: Customer
  totalSales: number
  totalPaid: number
  totalRemaining: number
  openingBalance: number
  totalDebt: number // المتبقي + الرصيد الافتتاحي
  salesCount: number
  lastSaleDate?: string
  sales: Sale[]
}

interface ReceivablesData {
  customers: ReceivableViewItem[]
  totalDebts: number
  aging: {
    fresh: number // 0-30 يوم
    medium: number // 31-60 يوم
    old: number // 60+ يوم
  }
}

async function fetchReceivables(search: string): Promise<ReceivablesData> {
  const customers = search
    ? await customerRepository.search(search)
    : await customerRepository.getAll()

  const items: ReceivableViewItem[] = []
  const now = Date.now()
  let agingFresh = 0
  let agingMedium = 0
  let agingOld = 0

  for (const c of customers) {
    const stats = await customerRepository.getWithStats(c.id)
    if (!stats) continue
    const openingBalance = c.openingBalance || 0
    const totalRemaining = stats.totalRemaining
    const totalDebt = totalRemaining + openingBalance

    if (totalDebt <= 0) continue // نعرض فقط العملاء اللي عليهم مبالغ

    // أحدث تاريخ فاتورة
    const lastSaleDate = stats.sales.length > 0 ? stats.sales[0].date : undefined

    // أعمار الديون - نصنف المديونية حسب أقدم فاتورة غير مسددة بالكامل
    const unpaidSales = stats.sales.filter((s) => s.paid < s.total)
    for (const s of unpaidSales) {
      const ageDays = (now - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24)
      const remaining = s.total - s.paid
      if (ageDays <= 30) agingFresh += remaining
      else if (ageDays <= 60) agingMedium += remaining
      else agingOld += remaining
    }
    if (openingBalance > 0 && unpaidSales.length === 0) {
      // لو مفيش فواتير لكن فيه رصيد افتتاحي
      agingOld += openingBalance
    }

    items.push({
      customer: c,
      totalSales: stats.totalSales,
      totalPaid: stats.totalPaid,
      totalRemaining,
      openingBalance,
      totalDebt,
      salesCount: stats.salesCount,
      lastSaleDate,
      sales: stats.sales,
    })
  }

  // ترتيب من الأعلى ديناً للأقل
  items.sort((a, b) => b.totalDebt - a.totalDebt)

  return {
    customers: items,
    totalDebts: items.reduce((s, x) => s + x.totalDebt, 0),
    aging: { fresh: agingFresh, medium: agingMedium, old: agingOld },
  }
}

export function ReceivablesView({ onBack }: { onBack?: () => void }) {
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)

  const [search, setSearch] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<ReceivableViewItem | null>(null)
  const { toast } = useToast()

  // تحميل الذمم مع التحديث الفوري
  const { data, loading, reload } = useLiveData<ReceivablesData>(
    () => fetchReceivables(search),
    ['customers', 'sales', 'payments', 'treasuryTransactions']
  )

  // إعادة التحميل عند تغير البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  const customers = data?.customers || []
  const totalDebts = data?.totalDebts || 0
  const aging = data?.aging || { fresh: 0, medium: 0, old: 0 }

  const openPayment = (item: ReceivableViewItem) => {
    setSelectedCustomer(item)
    setPaymentOpen(true)
  }

  const openStatement = (item: ReceivableViewItem) => {
    setSelectedCustomer(item)
    setStatementOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
              <X className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800">الذمم (المديونيات)</h2>
            <p className="text-xs text-slate-500">إدارة ديون العملاء والسدادات</p>
          </div>
        </div>
      </div>

      {/* بطاقة إجمالي المديونيات */}
      <div className="bg-gradient-to-l from-rose-500 to-red-600 text-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs opacity-90">إجمالي المديونيات</p>
            <p className="text-2xl font-bold">{formatCurrency(totalDebts)}</p>
            <p className="text-[11px] opacity-80 mt-0.5">
              عدد العملاء المدينين: {customers.length}
            </p>
          </div>
        </div>
      </div>

      {/* أعمار الديون */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
          <p className="text-[10px] text-emerald-700">0 - 30 يوم</p>
          <p className="text-sm font-bold text-emerald-900">{formatCurrency(aging.fresh)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
          <p className="text-[10px] text-amber-700">31 - 60 يوم</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(aging.medium)}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 text-center">
          <p className="text-[10px] text-rose-700">+60 يوم</p>
          <p className="text-sm font-bold text-rose-900">{formatCurrency(aging.old)}</p>
        </div>
      </div>

      {/* البحث */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* قائمة العملاء */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مديونيات حالياً</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map((item) => {
            // تحذير تجاوز حد الائتمان
            const overLimit =
              item.customer.creditLimit &&
              item.customer.creditLimit > 0 &&
              item.totalDebt > item.customer.creditLimit
            return (
              <div
                key={item.customer.id}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white font-bold text-sm">
                      {item.customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{item.customer.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        {item.customer.phone && <span>{item.customer.phone}</span>}
                        {item.lastSaleDate && (
                          <span>آخر عملية: {formatDate(item.lastSaleDate)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => openStatement(item)}
                    >
                      <FileText className="w-3.5 h-3.5 ml-1" />
                      كشف حساب
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => openPayment(item)}
                    >
                      <HandCoins className="w-3.5 h-3.5 ml-1" />
                      سداد دفعة
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
                    <p className="font-bold text-emerald-900">{formatCurrency(item.totalSales)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-blue-700">المدفوع</p>
                    <p className="font-bold text-blue-900">{formatCurrency(item.totalPaid)}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-rose-700">المتبقي</p>
                    <p className="font-bold text-rose-900">{formatCurrency(item.totalDebt)}</p>
                  </div>
                </div>

                {item.openingBalance > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    رصيد افتتاحي: {formatCurrency(item.openingBalance)} + مبيعات آجلة: {formatCurrency(item.totalRemaining)}
                  </p>
                )}

                {overLimit && (
                  <div className="mt-2 flex items-center gap-1.5 bg-rose-100 text-rose-700 text-[11px] rounded px-2 py-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>تجاوز حد الائتمان ({formatCurrency(item.customer.creditLimit || 0)})</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* نافذة السداد */}
      {selectedCustomer && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          customer={selectedCustomer}
        />
      )}

      {/* نافذة كشف الحساب */}
      {selectedCustomer && (
        <StatementDialog
          open={statementOpen}
          onOpenChange={setStatementOpen}
          customer={selectedCustomer}
        />
      )}
    </div>
  )
}

// ===== نافذة السداد =====
interface PaymentDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: ReceivableViewItem
}

function PaymentDialog({ open, onOpenChange, customer }: PaymentDialogProps) {
  const [invoiceId, setInvoiceId] = useState('__none__')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // الفواتير غير المسددة بالكامل
  const unpaidInvoices = useMemo(
    () => customer.sales.filter((s) => s.paid < s.total),
    [customer]
  )

  useEffect(() => {
    if (open) {
      setInvoiceId('__none__')
      setAmount('')
      setMethod('cash')
      setDate(todayStr())
      setNotes('')
    }
  }, [open])

  const save = async () => {
    const amountNum = Number(amount) || 0
    if (amountNum <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const selectedInvoice = invoiceId !== '__none__'
        ? customer.sales.find((s) => s.id === invoiceId)
        : undefined

      await paymentRepository.create({
        type: 'customer_payment',
        partyId: customer.customer.id,
        partyName: customer.customer.name,
        invoiceId: selectedInvoice?.id,
        invoiceNo: selectedInvoice?.invoiceNo,
        amount: amountNum,
        date,
        method,
        notes: notes || undefined,
      })
      toast({
        title: 'تم',
        description: `تم تسجيل سداد ${formatCurrency(amountNum)} من ${customer.customer.name}`,
      })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-right">سداد دفعة - {customer.customer.name}</DialogTitle>
          <DialogDescription className="sr-only">تسجيل سداد دفعة من العميل</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-2">
          <div className="bg-rose-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-rose-700">إجمالي المديونية</p>
            <p className="text-lg font-bold text-rose-900">{formatCurrency(customer.totalDebt)}</p>
          </div>

          <div>
            <Label className="text-xs">الفاتورة (اختياري)</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="سداد عام بدون فاتورة محددة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— سداد عام —</SelectItem>
                {unpaidInvoices.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.invoiceNo ? `فاتورة ${s.invoiceNo}` : `فاتورة ${formatDate(s.date)}`}
                    {' - متبقي '}
                    {formatCurrency(s.total - s.paid)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">مبلغ السداد *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="bg-slate-50"
              min="0"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">طريقة السداد</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">كاش</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-50"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات السداد..."
              className="bg-slate-50 text-sm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 px-1 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'تسجيل السداد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== نافذة كشف الحساب =====
interface StatementDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: ReceivableViewItem
}

function StatementDialog({ open, onOpenChange, customer }: StatementDialogProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  useEffect(() => {
    if (open) {
      Promise.resolve().then(() => setLoadingPayments(true))
      paymentRepository
        .getByParty(customer.customer.id)
        .then(setPayments)
        .catch((e) => {
          console.error('[ReceivablesView] تعذر تحميل السدادات:', e)
          setPayments([])
        })
        .finally(() => Promise.resolve().then(() => setLoadingPayments(false)))
    }
  }, [open, customer.customer.id])

  // دمج المبيعات والسدادات في ترتيب زمني
  type Tx = {
    id: string
    date: string
    type: 'sale' | 'payment'
    description: string
    debit: number // مدين (مبيعات)
    credit: number // دائن (سدادات)
    refNo?: string
  }
  const txs: Tx[] = [
    ...customer.sales.map<Tx>((s) => ({
      id: s.id,
      date: s.date,
      type: 'sale' as const,
      description: `فاتورة مبيعات`,
      debit: s.total,
      credit: 0,
      refNo: s.invoiceNo,
    })),
    ...payments.map<Tx>((p) => ({
      id: p.id,
      date: p.date,
      type: 'payment' as const,
      description: `سداد ${p.method ? `(${p.method})` : ''}`,
      debit: 0,
      credit: p.amount,
      refNo: p.invoiceNo,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // حساب الرصيد تراكمياً باستخدام reduce (بدون إعادة إسناد لمتغير خارجي)
  const txsWithBalance = txs.reduce<Array<Tx & { balance: number }>>(
    (acc, t) => {
      const prevBalance = acc.length > 0 ? acc[acc.length - 1].balance : customer.openingBalance
      const newBalance = prevBalance + t.debit - t.credit
      return [...acc, { ...t, balance: newBalance }]
    },
    []
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            كشف حساب: {customer.customer.name}
          </DialogTitle>
          <DialogDescription className="sr-only">كشف حساب تفصيلي للعميل</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-6">
          {/* ملخص */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
              <p className="text-xs font-bold text-emerald-900">{formatCurrency(customer.totalSales)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-700">المدفوع</p>
              <p className="text-xs font-bold text-blue-900">{formatCurrency(customer.totalPaid)}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-rose-700">الرصيد</p>
              <p className="text-xs font-bold text-rose-900">{formatCurrency(customer.totalDebt)}</p>
            </div>
          </div>

          {/* رصيد افتتاحي */}
          {customer.openingBalance > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded p-2 text-xs text-amber-800 flex justify-between">
              <span>رصيد افتتاحي</span>
              <span className="font-bold">{formatCurrency(customer.openingBalance)}</span>
            </div>
          )}

          {/* المعاملات */}
          <div className="bg-white border border-slate-100 rounded-lg max-h-96 overflow-y-auto">
            {txsWithBalance.length === 0 ? (
              <p className="text-center text-xs text-slate-500 p-4">لا توجد معاملات</p>
            ) : (
              txsWithBalance.map((t) => (
                <div
                  key={`${t.type}-${t.id}`}
                  className="flex items-start justify-between p-2 border-b border-slate-50 text-xs last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          t.type === 'sale'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]'
                            : 'bg-blue-50 text-blue-700 border-blue-200 text-[9px]'
                        }
                      >
                        {t.type === 'sale' ? 'مبيعة' : 'سداد'}
                      </Badge>
                      <span className="text-slate-500">{formatDate(t.date)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {t.description}
                      {t.refNo && <span className="text-slate-400"> - {t.refNo}</span>}
                    </p>
                  </div>
                  <div className="text-left flex flex-col items-end gap-0.5">
                    {t.debit > 0 && (
                      <span className="font-bold text-emerald-700">+{formatCurrency(t.debit)}</span>
                    )}
                    {t.credit > 0 && (
                      <span className="font-bold text-blue-700">-{formatCurrency(t.credit)}</span>
                    )}
                    <span className="text-[10px] text-slate-500">رصيد: {formatCurrency(t.balance)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {loadingPayments && (
            <p className="text-center text-xs text-slate-400">جارٍ تحميل السدادات...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
