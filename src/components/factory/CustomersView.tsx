'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  customerRepository,
  dataChangeEmitter,
  useLiveData,
} from '@/lib/db'
import { CustomerCard, type CustomerWithStats } from './customers/CustomerCard'
import { CustomerForm } from './customers/CustomerForm'
import { CustomerReport } from './customers/CustomerReport'

// جلب العملاء مع الإحصائيات (يدعم البحث)
async function fetchCustomers(search: string): Promise<CustomerWithStats[]> {
  const data = search
    ? await customerRepository.search(search)
    : await customerRepository.getAllWithStats()
  return data as CustomerWithStats[]
}

export function CustomersView({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<CustomerWithStats | null>(null)
  const [reportCustomer, setReportCustomer] = useState<CustomerWithStats | null>(null)
  const { toast } = useToast()

  // تحميل العملاء مع التحديث الفوري
  const { data: customers, loading, reload } = useLiveData<CustomerWithStats[]>(
    () => fetchCustomers(search),
    ['customers', 'sales']
  )

  // إعادة التحميل عند تغير البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا العميل؟')) return
    try {
      await customerRepository.delete(id)
      dataChangeEmitter.notifyDelete('customers')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const customersList = customers || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">العملاء</h2>
            <p className="text-xs text-slate-500">إدارة بيانات العملاء وتقاريرهم</p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditCustomer(null)
            setOpen(true)
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          عميل جديد
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
      ) : customersList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد عملاء مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customersList.map((c) => (
            <CustomerCard
              key={c.id}
              customer={c}
              onEdit={() => {
                setEditCustomer(c)
                setOpen(true)
              }}
              onDelete={() => handleDelete(c.id)}
              onShowReport={() => setReportCustomer(c)}
            />
          ))}
        </div>
      )}

      <CustomerForm
        open={open}
        onOpenChange={setOpen}
        customer={editCustomer}
        onSaved={() => setOpen(false)}
      />
      {reportCustomer && (
        <CustomerReport
          customer={reportCustomer}
          onClose={() => setReportCustomer(null)}
        />
      )}
    </div>
  )
}
