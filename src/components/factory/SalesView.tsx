'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Search, ShoppingCart, Users, Filter, TrendingUp, Clock, AlertTriangle, Package, Percent, BarChart3, RotateCcw, ArrowDownUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  saleRepository,
  customerRepository,
  saleReturnRepository,
  dataChangeEmitter,
  useLiveData,
  type Sale,
  type Customer,
  type SaleReturn,
} from '@/lib/db'
import { CustomersView } from './CustomersView'
import { SaleCard } from './sales/SaleCard'
import { SaleForm } from './sales/SaleForm'

export function SalesView() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showCustomers, setShowCustomers] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<string>('all')

  // تحميل المبيعات مع التحديث الفوري
  const { data: sales, loading, reload: reloadSales } = useLiveData<Sale[]>(
    () => saleRepository.search(search, from || undefined, to || undefined),
    ['sales']
  )

  // تحميل العملاء
  const { data: customers, reload: reloadCustomers } = useLiveData<Customer[]>(
    () => customerRepository.getAll(),
    ['customers']
  )

  useEffect(() => {
    reloadSales()
  }, [search, from, to, reloadSales])

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    try {
      await saleRepository.delete(id)
      dataChangeEmitter.notifyDelete('sales')
    } catch (e: any) {
      console.error(e)
    }
  }

  const salesList = sales || []
  const customersList = customers || []

  // تطبيق فلتر السداد
  const filteredSales = useMemo(() => {
    let list = salesList
    if (paymentFilter === 'unpaid') {
      list = list.filter((s) => s.total - s.paid > 0)
    } else if (paymentFilter === 'paid') {
      list = list.filter((s) => s.total - s.paid <= 0)
    }
    return list
  }, [salesList, paymentFilter])

  const totalSales = filteredSales.reduce((s, x) => s + x.total, 0)
  const totalPaid = filteredSales.reduce((s, x) => s + x.paid, 0)
  const totalRemaining = totalSales - totalPaid

  // أكبر عملاء
  const topCustomers = useMemo(() => {
 const map = new Map<string, { name: string; total: number; count: number }>()
    for (const s of filteredSales) {
      const existing = map.get(s.customerName)
      if (existing) {
        existing.total += s.total
        existing.count += 1
      } else {
        map.set(s.customerName, { name: s.customerName, total: s.total, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [filteredSales])

  // آخر عملية بيع
  const lastSale = filteredSales.length > 0
    ? filteredSales.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
    : null

  // عدد الفواتير غير المسددة
  const unpaidCount = salesList.filter((s) => s.total - s.paid > 0).length

  // تحميل المرتجعات
  const { data: allReturns } = useLiveData<SaleReturn[]>(
    () => saleReturnRepository.getByDateRange(from || undefined, to || undefined),
    ['saleReturns']
  )
  const returnsList = allReturns || []
  const totalReturns = returnsList.reduce((s, r) => s + r.total, 0)

  // أعلى المنتجات مبيعاً
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>()
    for (const s of filteredSales) {
      for (const item of s.items) {
        const existing = map.get(item.itemName)
        if (existing) {
          existing.quantity += item.quantity
          existing.total += item.total
        } else {
          map.set(item.itemName, { name: item.itemName, quantity: item.quantity, total: item.total })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [filteredSales])

  // متوسط قيمة الفاتورة
  const avgInvoiceValue = filteredSales.length > 0
    ? totalSales / filteredSales.length
    : 0

  // نسبة التحصيل
  const collectionRate = totalSales > 0
    ? (totalPaid / totalSales) * 100
    : 0

  // صافي المبيعات (بعد المرتجعات)
  const netSales = totalSales - totalReturns

  // ملخص يومي
  const dailySummary = useMemo(() => {
    const map = new Map<string, { date: string; count: number; total: number; paid: number }>()
    for (const s of filteredSales) {
      const day = s.date.split('T')[0]
      const existing = map.get(day)
      if (existing) {
        existing.count += 1
        existing.total += s.total
        existing.paid += s.paid
      } else {
        map.set(day, { date: day, count: 1, total: s.total, paid: s.paid })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
  }, [filteredSales])

  const hasFilters = paymentFilter !== 'all' || from || to

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المبيعات</h2>
          <p className="text-xs text-slate-500">إدارة فواتير المبيعات</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCustomers(true)}
            className="border-slate-200"
          >
            <Users className="w-4 h-4 ml-1" />
            العملاء
          </Button>
          <Button
            onClick={() => setOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 ml-1" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* بطاقة الملخص المحسنة */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-100">إجمالي المبيعات المعروضة</p>
            <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-emerald-100">
              <span>{filteredSales.length} فاتورة</span>
              {lastSale && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  آخر عملية: {formatDate(lastSale.date)}
                </span>
              )}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* إحصائيات موسعة */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-blue-600" />
            </div>
            <p className="text-[10px] text-blue-700">المحصل</p>
          </div>
          <p className="text-sm font-bold text-blue-900">{formatCurrency(totalPaid)}</p>
          <p className="text-[9px] text-blue-600 mt-0.5">تحصيل {collectionRate.toFixed(0)}%</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center">
              <Clock className="w-3 h-3 text-amber-600" />
            </div>
            <p className="text-[10px] text-amber-700">المتبقي</p>
          </div>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(totalRemaining)}</p>
          <p className="text-[9px] text-amber-600 mt-0.5">{unpaidCount} فاتورة غير مسددة</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <div className="flex items-center gap-1 mb-1">
            <div className="w-5 h-5 rounded-md bg-rose-100 flex items-center justify-center">
              <RotateCcw className="w-3 h-3 text-rose-600" />
            </div>
            <p className="text-[10px] text-rose-700">المرتجعات</p>
          </div>
          <p className="text-sm font-bold text-rose-900">{formatCurrency(totalReturns)}</p>
          <p className="text-[9px] text-rose-600 mt-0.5">صافي: {formatCurrency(netSales)}</p>
        </div>
      </div>

      {/* صف ثانٍ من الإحصائيات */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-[9px] text-slate-500">متوسط الفاتورة</p>
          <p className="text-sm font-bold text-slate-800">{formatCurrency(avgInvoiceValue)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto mb-1">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[9px] text-slate-500">نسبة التحصيل</p>
          <p className="text-sm font-bold text-emerald-700">{collectionRate.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center mx-auto mb-1">
            <ShoppingCart className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-[9px] text-slate-500">إجمالي الأصناف</p>
          <p className="text-sm font-bold text-slate-800">{filteredSales.reduce((s, x) => s + x.items.length, 0)}</p>
        </div>
      </div>

      {/* أفضل العملاء + أفضل المنتجات */}
      <div className="grid grid-cols-2 gap-2">
        {topCustomers.length > 0 && (
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              أفضل العملاء
            </p>
            <div className="space-y-1.5">
              {topCustomers.slice(0, 3).map((c, i) => (
                <div key={c.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                      i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'
                    }`}>
                      {i + 1}
                    </div>
                    <p className="text-[11px] text-slate-700 truncate max-w-[80px]">{c.name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-emerald-700">{formatCurrency(c.total)}</p>
                    <p className="text-[9px] text-slate-400">{c.count} فاتورة</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {topProducts.length > 0 && (
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              أفضل المنتجات
            </p>
            <div className="space-y-1.5">
              {topProducts.slice(0, 3).map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                      i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-teal-400' : 'bg-emerald-700'
                    }`}>
                      {i + 1}
                    </div>
                    <p className="text-[11px] text-slate-700 truncate max-w-[80px]">{p.name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-emerald-700">{formatCurrency(p.total)}</p>
                    <p className="text-[9px] text-slate-400">{p.quantity} وحدة</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ملخص يومي */}
      {dailySummary.length > 1 && (
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
            <ArrowDownUp className="w-3.5 h-3.5 text-blue-600" />
            ملخص المبيعات اليومي (آخر {dailySummary.length} أيام)
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {dailySummary.map((d) => {
              const dayTotal = d.total
              const maxTotal = Math.max(...dailySummary.map(x => x.total))
              const barWidth = maxTotal > 0 ? (dayTotal / maxTotal) * 100 : 0
              return (
                <div key={d.date} className="min-w-[80px] shrink-0 bg-slate-50 rounded-lg p-2 border border-slate-100">
                  <p className="text-[9px] text-slate-500 text-center mb-1">{formatDate(d.date)}</p>
                  <div className="h-16 flex flex-col justify-end items-center gap-0.5">
                    <p className="text-[9px] font-bold text-slate-700">{formatCurrency(dayTotal)}</p>
                    <div className="w-full bg-emerald-200 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[8px] text-slate-400 text-center mt-1">{d.count} فاتورة</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* بحث + فلاتر */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">حالة السداد</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="paid">مسددة</SelectItem>
                <SelectItem value="unpaid">غير مسددة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setPaymentFilter('all') }} className="text-xs text-slate-500">
            <X className="w-3 h-3 ml-1" />
            مسح الفلترة ({filteredSales.length} نتيجة)
          </Button>
        )}
      </div>

      {/* قائمة المبيعات */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {hasFilters ? 'لا توجد مبيعات تطابق الفلتر' : 'لا توجد مبيعات مسجلة'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSales.map((sale) => (
            <SaleCard key={sale.id} sale={sale} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <SaleForm
        open={open}
        onOpenChange={setOpen}
        onSaved={() => setOpen(false)}
        customers={customersList}
      />

      {showCustomers && (
        <CustomersView
          onBack={() => {
            setShowCustomers(false)
            reloadCustomers()
            reloadSales()
          }}
        />
      )}
    </div>
  )
}
