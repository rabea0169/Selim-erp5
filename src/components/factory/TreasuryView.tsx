'use client'

import { useState, useEffect } from 'react'
import {
  Wallet,
  Calendar,
  TrendingUp,
  TrendingDown,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
import {
  treasuryRepository,
  dataChangeEmitter,
  useLiveData,
  type TreasuryTransaction,
} from '@/lib/db'

interface TreasuryData {
  balance: number
  depositsTotal: number
  withdrawalsTotal: number
  transactions: TreasuryTransaction[]
}

// الفئات المقترحة للإيداع والسحب
const DEPOSIT_CATEGORIES = [
  'مبيعات',
  'رأس مال',
  'قرض',
  'إيداع بنكي',
  'أخرى',
]
const WITHDRAWAL_CATEGORIES = [
  'مشتريات',
  'مصاريف',
  'سلف موظف',
  'رواتب',
  'إيجار',
  'مرافق',
  'أخرى',
]

async function fetchTreasury(from?: string, to?: string, type?: string): Promise<TreasuryData> {
  // الملخص من السيرفر (aggregate على كامل الجدول — لا يتأثر بعدد الحركات)
  // والقائمة مفلترة بالتاريخ/النوع
  const [summary, transactions] = await Promise.all([
    treasuryRepository.getSummary(),
    treasuryRepository.getByDateRange(from || undefined, to || undefined, type || undefined),
  ])
  return {
    balance: summary.balance,
    depositsTotal: summary.totalDeposits,
    withdrawalsTotal: summary.totalWithdrawals,
    transactions,
  }
}

export function TreasuryView() {
  const [open, setOpen] = useState(false)
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all')
  const { toast } = useToast()

  // تحميل بيانات الخزينة + التحديث الفوري
  const { data, loading, reload } = useLiveData<TreasuryData>(
    () => fetchTreasury(from || undefined, to || undefined, typeFilter === 'all' ? undefined : typeFilter),
    ['treasuryTransactions']
  )

  // إعادة التحميل عند تغير الفلاتر
  useEffect(() => {
    reload()
  }, [from, to, typeFilter, reload])

  const transactions: TreasuryTransaction[] = data?.transactions || []
  const balance: number = data?.balance ?? 0
  const depositsTotal: number = data?.depositsTotal ?? 0
  const withdrawalsTotal: number = data?.withdrawalsTotal ?? 0

  // هل يوجد فلتر زمني مفعّل؟ (الرصيد المعروض رصيد إجمالي مقصود ولا يتأثر بالفلتر)
  const hasDateFilter = Boolean(from || to)

  const openDeposit = () => {
    setTxType('deposit')
    setOpen(true)
  }
  const openWithdraw = () => {
    setTxType('withdrawal')
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذه المعاملة؟')) return
    try {
      await treasuryRepository.delete(id)
      dataChangeEmitter.notifyDelete('treasuryTransactions')
      toast({ title: 'تم الحذف' })
    } catch (e: any) {
      toast({ title: 'تعذر الحذف', description: e?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">الخزينة</h2>
          <p className="text-xs text-slate-500">إدارة النقدية والإيداعات والمصروفات</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openWithdraw}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm h-9 text-xs font-medium"
          >
            <ArrowUpCircle className="w-4 h-4 ml-1" />
            سحب
          </Button>
          <Button
            onClick={openDeposit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 text-xs font-medium"
          >
            <ArrowDownCircle className="w-4 h-4 ml-1" />
            إيداع
          </Button>
        </div>
      </div>

      {/* بطاقة الرصيد الحالي */}
      <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white rounded-2xl p-5 shadow-md relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-50 mb-1">رصيد الخزينة الحالي (إجمالي)</p>
            <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
            <p className="text-[10px] text-emerald-100 mt-1">
              إجمالي الإيداعات (الكلي): {formatCurrency(depositsTotal)}
            </p>
            <p className="text-[10px] text-emerald-100">
              إجمالي المصروفات (الكلي): {formatCurrency(withdrawalsTotal)}
            </p>
            {hasDateFilter && (
              <p className="text-[10px] text-emerald-50/90 mt-1 bg-white/10 rounded-md px-2 py-0.5 inline-block">
                ملاحظة: الرصيد إجمالي ولا يتأثر بفلترة التاريخ — الفلتر يطبق على قائمة الحركات فقط
              </p>
            )}
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Wallet className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* ملخص الإيداعات والمصروفات */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-500 font-medium">إجمالي الإيداعات (الكلي)</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(depositsTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-500 font-medium">إجمالي المصروفات (الكلي)</p>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-rose-700">{formatCurrency(withdrawalsTotal)}</p>
        </div>
      </div>

      {/* الفلاتر: النوع + التاريخ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 space-y-2">
        <div className="flex gap-1">
          {(['all', 'deposit', 'withdrawal'] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={typeFilter === v ? 'default' : 'ghost'}
              onClick={() => setTypeFilter(v)}
              className={`h-8 text-xs flex-1 ${
                typeFilter === v
                  ? v === 'deposit'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : v === 'withdrawal'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : ''
                  : 'text-slate-500'
              }`}
            >
              {v === 'all' ? 'الكل' : v === 'deposit' ? 'إيداعات' : 'سحوبات'}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
        </div>
        {(from || to || typeFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom('')
              setTo('')
              setTypeFilter('all')
            }}
            className="text-xs text-slate-500 h-9"
          >
            <X className="w-3 h-3 ml-1" />
            مسح الفلترة
          </Button>
        )}
      </div>

      {/* قائمة المعاملات */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد معاملات في الخزينة</p>
          <p className="text-xs text-slate-400 mt-1">ابدأ بإيداع أو سحب مبلغ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => {
            const isDeposit = t.type === 'deposit'
            const isLinked = Boolean((t as any).referenceId)
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isDeposit
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownCircle className="w-4 h-4" />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-bold ${
                        isDeposit ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                    {t.category && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          isDeposit
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {t.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pr-9">
                    <Calendar className="w-3 h-3" />
                    {formatDate(t.date)}
                    {t.description && (
                      <span className="truncate">• {t.description}</span>
                    )}
                  </div>
                  {t.notes && (
                    <p className="text-[10px] text-slate-400 pr-9 mt-0.5 truncate">
                      {t.notes}
                    </p>
                  )}
                </div>
                {!isLinked && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-rose-500"
                    onClick={() => handleDelete(t.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <TreasuryTransactionForm
        open={open}
        onOpenChange={setOpen}
        type={txType}
        onSaved={() => setOpen(false)}
      />
    </div>
  )
}

// ====== نموذج إضافة معاملة ======
interface FormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  type: 'deposit' | 'withdrawal'
  onSaved: () => void
}

function TreasuryTransactionForm({ open, onOpenChange, type, onSaved }: FormProps) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const isDeposit = type === 'deposit'
  const categories = isDeposit ? DEPOSIT_CATEGORIES : WITHDRAWAL_CATEGORIES

  const reset = () => {
    setAmount('')
    setDate(todayStr())
    setDescription('')
    setCategory('')
    setNotes('')
  }

  const save = async () => {
    const num = Number(amount)
    if (!num || num <= 0) {
      toast({ title: 'أدخل مبلغ صحيح', variant: 'destructive' })
      return
    }
    if (!description.trim()) {
      toast({ title: 'أدخل وصف المعاملة', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: isDeposit ? 'deposit' as const : 'withdrawal' as const,
        amount: num,
        date,
        description: description.trim(),
        category: category || undefined,
        notes: notes.trim() || undefined,
      }
      if (isDeposit) {
        await treasuryRepository.deposit(payload)
      } else {
        await treasuryRepository.withdraw(payload)
      }
      dataChangeEmitter.notifyCreate('treasuryTransactions')
      reset()
      onSaved()
      toast({
        title: isDeposit ? 'تم الإيداع' : 'تم السحب',
        description: formatCurrency(num),
      })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isDeposit ? (
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 text-rose-600" />
            )}
            {isDeposit ? 'إيداع في الخزينة' : 'سحب من الخزينة'}
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة معاملات الخزينة</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">المبلغ *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`bg-slate-50 text-lg font-bold ${
                isDeposit ? 'text-emerald-700' : 'text-rose-700'
              }`}
            />
          </div>

          <div>
            <Label className="text-xs">الوصف *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isDeposit ? 'مثال: تحصيل مبيعات اليوم' : 'مثال: دفع إيجار'}
              className="bg-slate-50"
            />
          </div>

          <div>
            <Label className="text-xs">الفئة</Label>
            <Select
              value={category || '__none__'}
              onValueChange={(v) => setCategory(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر فئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون فئة —</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
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

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="bg-slate-50 text-sm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 text-xs font-medium"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className={`text-white h-9 text-xs font-medium ${
              isDeposit
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {saving ? 'جارٍ الحفظ...' : isDeposit ? 'إيداع' : 'سحب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
