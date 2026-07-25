'use client'

import { usePermissions } from '@/hooks/usePermissions'
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)
import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
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
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/hooks/usePermissions'
import { Label } from '@/components/ui/label'
import { usePermissions } from '@/hooks/usePermissions'
import { Badge } from '@/components/ui/badge'
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
  expenseRepository,
  expenseCategoryRepository,
  dataChangeEmitter,
  useLiveData,
} { getCurrentUser } from '@/lib/db'
import { usePermissions } from '@/hooks/usePermissions'
import { ExpenseForm } from './expenses/ExpenseForm'
import { usePermissions } from '@/hooks/usePermissions'
import { CategoryManager } from './expenses/CategoryManager'
import type { Expense, ExpenseCategory } from './expenses/types'

// جلب المصاريف + البنود + إحصائيات عدد المصاريف لكل بند
async function fetchExpensesAndCategories(
  search: string,
  from: string,
  to: string,
  filterCat: string
): Promise<{ expenses: Expense[]; categories: ExpenseCategory[] }> {
  const [expData, catData, allExpenses] = await Promise.all([
    expenseRepository.search(search, from || undefined, to || undefined, filterCat || undefined),
    expenseCategoryRepository.getAll(),
    expenseRepository.getAll(),
  ])

  // حساب عدد المصاريف لكل بند
  const countByCat: Record<string, number> = {}
  for (const e of allExpenses) {
    countByCat[e.categoryId] = (countByCat[e.categoryId] || 0) + 1
  }
  const catsWithCount: ExpenseCategory[] = catData.map((c) => ({
    ...c,
    notes: c.notes ?? null,
    expenseCount: countByCat[c.id] || 0,
  }))

  return {
    expenses: expData as Expense[],
    categories: catsWithCount,
  }
}

export function ExpensesView() {
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  // تحميل المصاريف + البنود مع التحديث الفوري
  const { data, loading, reload } = useLiveData(
    () => fetchExpensesAndCategories(search, from, to, filterCat),
    ['expenses', 'expenseCategories']
  )

  // إعادة التحميل عند تغير الفلاتر
  useEffect(() => {
    reload()
  }, [search, filterCat, from, to, reload])

  const handleDelete = async (id: string) => {
    if (!perms.canDelete) { alert("ليس لديك صلاحية الحذف"); return }
    if (!confirm('حذف هذا المصروف؟')) return
    try {
      await expenseRepository.delete(id)
      dataChangeEmitter.notifyDelete('expenses')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const expensesList: Expense[] = data?.expenses || []
  const categoriesList: ExpenseCategory[] = data?.categories || []

  const total = expensesList.reduce((s, e) => s + e.amount, 0)

  // Group by category for the bar visualization
  const byCategory: Record<string, number> = {}
  expensesList.forEach((e) => {
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
              {categoriesList.map((c) => (
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
      ) : expensesList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مصاريف مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expensesList.map((e) => (
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
        categories={categoriesList}
        onSaved={() => setOpen(false)}
      />
      <CategoryManager
        open={catOpen}
        onOpenChange={setCatOpen}
        categories={categoriesList}
        onSaved={reload}
      />
    </div>
  )
}
