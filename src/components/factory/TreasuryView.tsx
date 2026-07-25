'use client'

import { usePermissions } from '@/hooks/usePermissions'
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)
import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Plus,
  Minus,
  Search,
  Wallet,
  Calendar,
  TrendingUp,
  TrendingDown,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Tag,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/hooks/usePermissions'
import { Label } from '@/components/ui/label'
import { usePermissions } from '@/hooks/usePermissions'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/hooks/usePermissions'
import { Textarea } from '@/components/ui/textarea'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
import { usePermissions } from '@/hooks/usePermissions'
import {
  treasuryRepository,
  dataChangeEmitter,
  useLiveData,
  type TreasuryTransaction,
} { getCurrentUser } from '@/lib/db'

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

async function fetchTreasury(from?: string, to?: string): Promise<TreasuryData> {
  const [balance, depositsTotal, withdrawalsTotal, transactions] = await Promise.all([
    treasuryRepository.getBalance(),
    treasuryRepository.getDepositsTotal(),
    treasuryRepository.getWithdrawalsTotal(),
    treasuryRepository.getByDateRange(from || undefined, to || undefined),
  ])
  return {
    balance,
    depositsTotal,
    withdrawalsTotal,
    transactions,
  }
}

export function TreasuryView() {
  const [open, setOpen] = useState(false)
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  // تحميل بيانات الخزينة + التحديث الفوري
  const { data, loading, reload } = useLiveData<TreasuryData>(
    () => fetchTreasury(from || undefined, to || undefined),
    ['treasuryTransactions']
  )

  // إعادة التحميل عند تغير الفلاتر
  useEffect(() => {
    reload()
  }, [from, to, reload])

  const transactions: TreasuryTransaction[] = data?.transactions || []
  const balance: number = data?.balance ?? 0
  const depositsTotal: number = data?.depositsTotal ?? 0
  const withdrawalsTotal: number = data?.withdrawalsTotal ?? 0

  const openDeposit = () => {
    setTxType('deposit')
    setOpen(true)
  }
  const openWithdraw = () => {
    setTxType('withdrawal')
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!perms.canDelete) { alert("ليس لديك صلاحية الحذف"); return }
    if (!confirm('حذف هذه المعاملة؟')) return
    try {
      await treasuryRepository.delete(id)
      dataChangeEmitter.notifyDelete('treasuryTransactions')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
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
            <p className="text-xs text-emerald-50 mb-1">رصيد الخزينة الحالي</p>
            <p className="text-3xl font-bold">{formatCurrency(balance)}</p>
            <p className="text-[10px] text-emerald-100 mt-1">
              إجمالي الإيداعات: {formatCurrency(depositsTotal)}
            </p>
            <p className="text-[10px] text-emerald-100">
              إجمالي المصروفات: {formatCurrency(withdrawalsTotal)}
            </p>
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
            <p className="text-[11px] text-slate-500 font-medium">إجمالي الإيداعات</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(depositsTotal)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-slate-500 font-medium">إجمالي المصروفات</p>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            </div>
          </div>
          <p className="text-sm font-bold text-rose-700">{formatCurrency(withdrawalsTotal)}</p>
        </div>
      </div>

      {/* فلترة بالتاريخ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 space-y-2">
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
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom('')
              setTo('')
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-400 hover:text-rose-500"
                  onClick={() => handleDelete(t.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
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
