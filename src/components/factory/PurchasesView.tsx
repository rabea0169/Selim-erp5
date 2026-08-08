'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Search, Package, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  purchaseRepository,
  supplierRepository,
  dataChangeEmitter,
  useLiveData,
  type Purchase,
  type Supplier,
} from '@/lib/db'
import { SuppliersView } from './SuppliersView'
import { PurchaseCard } from './purchases/PurchaseCard'
import { PurchaseForm } from './purchases/PurchaseForm'

export function PurchasesView() {
  const [open, setOpen] = useState(false)
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showSuppliers, setShowSuppliers] = useState(false)
  const { toast } = useToast()

  // تحميل المشتريات مع التحديث الفوري عند تغير البيانات
  const { data: purchases, loading, reload: reloadPurchases } = useLiveData<Purchase[]>(
    () => purchaseRepository.search(search, from || undefined, to || undefined),
    ['purchases']
  )

  // تحميل الموردين مع التحديث الفوري
  const { data: suppliers, reload: reloadSuppliers } = useLiveData<Supplier[]>(
    () => supplierRepository.getAll(),
    ['suppliers']
  )

  // إعادة التحميل عند تغير الفلاتر (search/from/to)
  useEffect(() => {
    reloadPurchases()
  }, [search, from, to, reloadPurchases])

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    try {
      await purchaseRepository.delete(id)
      dataChangeEmitter.notifyDelete('purchases')
    } catch (e: any) {
      console.error(e)
      toast({ title: 'خطأ في حذف الفاتورة', description: e.message, variant: 'destructive' })
    }
  }

  const handleEdit = (p: Purchase) => {
    setEditPurchase(p)
    setOpen(true)
  }

  const handleOpenChange = (v: boolean) => {
    setOpen(v)
    if (!v) setEditPurchase(null)
  }

  const purchasesList = purchases || []
  const suppliersList = suppliers || []

  const totalPurchases = purchasesList.reduce((s, x) => s + x.total, 0)
  const totalPaid = purchasesList.reduce((s, x) => s + x.paid, 0)
  const totalRemaining = totalPurchases - totalPaid

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المشتريات</h2>
          <p className="text-xs text-slate-500">إدارة فواتير المشتريات من الموردين</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSuppliers(true)} className="border-slate-200">
            <Truck className="w-4 h-4 ml-1" />
            الموردين
          </Button>
          <Button onClick={() => { setEditPurchase(null); setOpen(true) }} className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm">
            <Plus className="w-4 h-4 ml-1" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-[10px] text-amber-700">إجمالي المشتريات</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-[10px] text-blue-700">المدفوع</p>
          <p className="text-sm font-bold text-blue-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <p className="text-[10px] text-rose-700">المتبقي للموردين</p>
          <p className="text-sm font-bold text-rose-900">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="بحث باسم المورد أو رقم الفاتورة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9 bg-slate-50 border-slate-200" />
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
          {[1, 2, 3].map((i) => (<div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />))}
        </div>
      ) : purchasesList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مشتريات مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {purchasesList.map((p) => (
            <PurchaseCard key={p.id} purchase={p} onDelete={handleDelete} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <PurchaseForm open={open} onOpenChange={handleOpenChange} onSaved={() => setOpen(false)} suppliers={suppliersList} editPurchase={editPurchase} />
      {showSuppliers && (
        <SuppliersView
          onBack={() => {
            setShowSuppliers(false)
            reloadSuppliers()
            reloadPurchases()
          }}
        />
      )}
    </div>
  )
}
