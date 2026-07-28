'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Users,
  Clock,
  Scissors,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  workerRepository,
  useLiveData,
  type Worker as WorkerType,
} from '@/lib/db'
import { AttendanceView } from './AttendanceView'
import { ProductionView } from './ProductionView'
import { WorkerCard } from './workers/WorkerCard'
import { WorkerForm } from './workers/WorkerForm'
import type { WorkerWithStats } from './workers/types'

type SubView = 'list' | 'attendance' | 'production'

// جلب الموظفين مع الإحصائيات (يدعم البحث)
async function fetchWorkers(search: string): Promise<WorkerWithStats[]> {
  const data = search
    ? await workerRepository.search(search)
    : await workerRepository.getAllWithStats()

  // getAllWithStats returns workers with embedded advances/receipts/balance
  // search() returns plain Worker[] without stats, so normalize
  const normalized: WorkerWithStats[] = await Promise.all(
    data.map(async (w: any) => {
      if (w.advances !== undefined) {
        return {
          id: w.id,
          name: w.name,
          phone: w.phone ?? null,
          job: w.job ?? null,
          type: (w as WorkerType).type ?? 'monthly',
          notes: w.notes ?? null,
          advances: w.advances || [],
          receipts: w.receipts || [],
          totalAdvances: w.totalAdvances || 0,
          totalReceipts: w.totalReceipts || 0,
          balance: w.balance || 0,
        }
      }
      // search() path: fetch stats
      const stats = await workerRepository.getWithStats(w.id)
      return {
        id: w.id,
        name: w.name,
        phone: w.phone ?? null,
        job: w.job ?? null,
        type: w.type ?? 'monthly',
        notes: w.notes ?? null,
        advances: stats?.advances || [],
        receipts: stats?.receipts || [],
        totalAdvances: stats?.totalAdvances || 0,
        totalReceipts: stats?.totalReceipts || 0,
        balance: stats?.balance || 0,
      }
    })
  )
  return normalized
}

export function WorkersView() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [subView, setSubView] = useState<'list' | 'attendance' | 'production'>('list')
  const currentView = subView as string
  const { toast } = useToast()

  // تحميل الموظفين مع التحديث الفوري عند تغير السلف/القبض/الإنتاج
  const { data: workers, loading, reload } = useLiveData<WorkerWithStats[]>(
    () => fetchWorkers(search),
    ['workers', 'workerAdvances', 'workerReceipts', 'production']
  )

  // إعادة التحميل عند تغير البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  if (currentView === 'attendance') {
    return <AttendanceView onBack={() => setSubView('list')} />
  }
  if (currentView === 'production') {
    return <ProductionView onBack={() => setSubView('list')} />
  }


  const workersList = workers || []
  const totalAdvances = workersList.reduce((s, w) => s + w.totalAdvances, 0)
  const totalReceipts = workersList.reduce((s, w) => s + w.totalReceipts, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">الموظفين</h2>
          <p className="text-xs text-slate-500">إدارة الموظفين والسلف والقبض</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4 ml-1" />
          موظف جديد
        </Button>
      </div>

      {/* Sub navigation */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setSubView('list')}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
            subView === 'list'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 mx-auto mb-1" />
          بيانات الموظفين
        </button>
        <button
          onClick={() => setSubView('attendance')}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
            currentView === 'attendance'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4 mx-auto mb-1" />
          حضور وانصراف
        </button>
        <button
          onClick={() => setSubView('production')}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
            currentView === 'production'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Scissors className="w-4 h-4 mx-auto mb-1" />
          إنتاج بالقطعة
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
          <p className="text-[10px] text-purple-700">عدد الموظفين</p>
          <p className="text-sm font-bold text-purple-900">{workersList.length}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <p className="text-[10px] text-rose-700">إجمالي السلف</p>
          <p className="text-sm font-bold text-rose-900">{formatCurrency(totalAdvances)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] text-emerald-700">إجمالي القبض</p>
          <p className="text-sm font-bold text-emerald-900">{formatCurrency(totalReceipts)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم الموظف أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : workersList.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد موظفين مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workersList.map((w) => (
            <WorkerCard key={w.id} worker={w} onChanged={reload} />
          ))}
        </div>
      )}

      <WorkerForm
        open={open}
        onOpenChange={setOpen}
        onSaved={() => setOpen(false)}
      />
    </div>
  )
}
