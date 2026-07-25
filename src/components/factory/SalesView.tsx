'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { useState, useEffect } from 'react'
import { Plus, X, Search, ShoppingCart, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/format'
import {
  saleRepository,
  customerRepository,
  dataChangeEmitter,
  useLiveData,
  type Sale,
  type Customer,
  getCurrentUser,
} from '@/lib/db'
import { CustomersView } from './CustomersView'
import { SaleCard } from './sales/SaleCard'
import { SaleForm } from './sales/SaleForm'

export function SalesView() {
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showCustomers, setShowCustomers] = useState(false)

  // تحميل المبيعات مع التحديث الفوري عند تغير البيانات
  const { data: sales, loading, reload: reloadSales } = useLiveData<Sale[]>(
    () => saleRepository.search(search, from || undefined, to || undefined),
    ['sales']
  )

  // تحميل العملاء مع التحديث الفوري
  const { data: customers, reload: reloadCustomers } = useLiveData<Customer[]>(
    () => customerRepository.getAll(),
    ['customers']
  )

  // إعادة التحميل عند تغير الفلاتر (search/from/to)
  useEffect(() => {
    reloadSales()
  }, [search, from, to, reloadSales])

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    if (!perms.canDelete) { alert('ليس لديك صلاحية الحذف'); return }
    try {
      await saleRepository.delete(id)
      dataChangeEmitter.notifyDelete('sales')
    } catch (e: any) {
      console.error(e)
    }
  }

  const salesList = sales || []
  const customersList = customers || []

  const totalSales = salesList.reduce((s, x) => s + x.total, 0)
  const totalPaid = salesList.reduce((s, x) => s + x.paid, 0)
  const totalRemaining = totalSales - totalPaid

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

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
          <p className="text-sm font-bold text-emerald-900">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-[10px] text-blue-700">المحصل</p>
          <p className="text-sm font-bold text-blue-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-[10px] text-amber-700">المتبقي</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
        </div>
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }} className="text-xs text-slate-500">
            <X className="w-3 h-3 ml-1" />
            مسح الفلترة
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : salesList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مبيعات مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {salesList.map((sale) => (
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
