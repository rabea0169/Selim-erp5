'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Truck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  supplierRepository,
  dataChangeEmitter,
  useLiveData,
} from '@/lib/db'
import { SupplierCard, type SupplierWithStats } from './suppliers/SupplierCard'
import { SupplierForm } from './suppliers/SupplierForm'
import { SupplierReport } from './suppliers/SupplierReport'

// جلب الموردين مع الإحصائيات (يدعم البحث)
async function fetchSuppliers(search: string): Promise<SupplierWithStats[]> {
  const data = search
    ? await supplierRepository.search(search)
    : await supplierRepository.getAllWithStats()
  return data as SupplierWithStats[]
}

export function SuppliersView({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editSupplier, setEditSupplier] = useState<SupplierWithStats | null>(null)
  const [reportSupplier, setReportSupplier] = useState<SupplierWithStats | null>(null)
  const { toast } = useToast()

  // تحميل الموردين مع التحديث الفوري
  const { data: suppliers, loading, reload } = useLiveData<SupplierWithStats[]>(
    () => fetchSuppliers(search),
    ['suppliers', 'purchases']
  )

  // إعادة التحميل عند تغير البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المورد؟')) return
    try {
      await supplierRepository.delete(id)
      dataChangeEmitter.notifyDelete('suppliers')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const suppliersList = suppliers || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">الموردين</h2>
            <p className="text-xs text-slate-500">إدارة بيانات الموردين وتقاريرهم</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditSupplier(null)
            setOpen(true)
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          مورد جديد
        </Button>
      </div>

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

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : suppliersList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد موردين مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliersList.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={() => {
                setEditSupplier(s)
                setOpen(true)
              }}
              onDelete={() => handleDelete(s.id)}
              onShowReport={() => setReportSupplier(s)}
            />
          ))}
        </div>
      )}

      <SupplierForm
        open={open}
        onOpenChange={setOpen}
        supplier={editSupplier}
        onSaved={() => setOpen(false)}
      />
      {reportSupplier && (
        <SupplierReport supplier={reportSupplier} onClose={() => setReportSupplier(null)} />
      )}
    </div>
  )
}
