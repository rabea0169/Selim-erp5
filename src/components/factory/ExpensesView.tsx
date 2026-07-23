'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Wallet,
  Calendar,
  Tag,
  Settings,
  X,
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
import { expenseRepository, expenseCategoryRepository } from '@/lib/db'

interface ExpenseCategory {
  id: string
  name: string
  notes: string | null
  expenseCount?: number
}

interface Expense {
  id: string
  categoryId: string
  categoryName: string
  amount: number
  date: string
  notes: string | null
}

export function ExpensesView() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [expData, catData] = await Promise.all([
        expenseRepository.search(search, from || undefined, to || undefined, filterCat || undefined),
        expenseCategoryRepository.getAll(),
      ])

      // حساب عدد المصاريف لكل بند
      const countByCat: Record<string, number> = {}
      const allExpenses = await expenseRepository.getAll()
      for (const e of allExpenses) {
        countByCat[e.categoryId] = (countByCat[e.categoryId] || 0) + 1
      }
      const catsWithCount = catData.map((c) => ({
        ...c,
        notes: c.notes ?? null,
        expenseCount: countByCat[c.id] || 0,
      }))

      setExpenses(expData as Expense[])
      setCategories(catsWithCount)
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل المصاريف', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, filterCat, from, to, toast])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المصروف؟')) return
    try {
      await expenseRepository.delete(id)
      toast({ title: 'تم الحذف' })
      load()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Group by category for the bar visualization
  const byCategory: Record<string, number> = {}
  expenses.forEach((e) => {
    byCategory[e.categoryName] = (byCategory[e.categoryName] || 0) + e.amount
  })
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المصاريف</h2>
          <p className="text-xs text-slate-500">إدارة مصاريف المصنع ببنودها</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCatOpen(true)}
            className="border-slate-200"
            title="إدارة البنود"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => setOpen(true)}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 ml-1" />
            مصروف جديد
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-rose-500 to-red-600 text-white rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-rose-100">إجمالي المصاريف (في الفلتر الحالي)</p>
            <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Categories overview */}
      {sortedCats.length > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            المصاريف حسب البند
          </p>
          <div className="space-y-1.5">
            {sortedCats.map(([name, amount]) => {
              const pct = total > 0 ? (amount / total) * 100 : 0
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-700 font-medium">{name}</span>
                    <span className="font-bold text-rose-700">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-rose-500 to-red-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث في الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
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
        <div>
          <Label className="text-[10px] text-slate-500">فلترة بالبند</Label>
          <Select value={filterCat || 'all'} onValueChange={(v) => setFilterCat(v === 'all' ? '' : v)}>
            <SelectTrigger className="bg-slate-50 border-slate-200 text-sm">
              <SelectValue placeholder="كل البنود" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل البنود</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(from || to || filterCat) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom('')
              setTo('')
              setFilterCat('')
            }}
            className="text-xs text-slate-500"
          >
            <X className="w-3 h-3 ml-1" />
            مسح الفلترة
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مصاريف مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                    {e.categoryName}
                  </Badge>
                  <span className="text-sm font-bold text-rose-700">
                    {formatCurrency(e.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Calendar className="w-3 h-3" />
                  {formatDate(e.date)}
                  {e.notes && <span className="truncate">• {e.notes}</span>}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-rose-500"
                onClick={() => handleDelete(e.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ExpenseForm
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        onSaved={() => {
          setOpen(false)
          load()
        }}
      />
      <CategoryManager
        open={catOpen}
        onOpenChange={setCatOpen}
        categories={categories}
        onSaved={load}
      />
    </div>
  )
}

function ExpenseForm({
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: ExpenseCategory[]
  onSaved: () => void
}) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const save = async () => {
    if (!categoryId) {
      toast({ title: 'تنبيه', description: 'اختر بند المصروف', variant: 'destructive' })
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await expenseRepository.createWithCategory({
        categoryId,
        amount: Number(amount),
        date,
        notes: notes || undefined,
      })
      toast({ title: 'تم', description: 'تم تسجيل المصروف' })
      setCategoryId('')
      setAmount('')
      setNotes('')
      setDate(todayStr())
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">مصروف جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">بند المصروف *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر البند" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">المبلغ *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-50 border-rose-200"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-50" />
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-slate-50" rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryManager({
  open,
  onOpenChange,
  categories,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: ExpenseCategory[]
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const addCategory = async () => {
    if (!name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم البند', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await expenseCategoryRepository.create({ name, notes: notes || undefined })
      toast({ title: 'تم', description: 'تمت إضافة البند' })
      setName('')
      setNotes('')
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const deleteCategory = async (id: string, count: number = 0) => {
    const msg = count > 0
      ? `هذا البند مرتبط بـ ${count} مصروف. سيتم حذفهم جميعاً. هل أنت متأكد؟`
      : 'حذف هذا البند؟'
    if (!confirm(msg)) return
    try {
      await expenseCategoryRepository.delete(id)
      toast({ title: 'تم الحذف' })
      onSaved()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إدارة بنود المصاريف</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div>
              <Label className="text-xs">اسم البند الجديد</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-white" />
            </div>
            <Button
              onClick={addCategory}
              disabled={saving}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white"
              size="sm"
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة بند
            </Button>
          </div>

          <div className="space-y-1 max-h-60 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-4">لا توجد بنود</p>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-white border border-slate-100 rounded-lg p-2 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.expenseCount !== undefined && c.expenseCount > 0 && (
                      <p className="text-[10px] text-slate-500">{c.expenseCount} مصروف</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-rose-500"
                    onClick={() => deleteCategory(c.id, c.expenseCount || 0)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
