'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Scissors,
  X,
  Search,
  Calendar,
  TrendingUp,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  workerRepository,
  productionRepository,
  dataChangeEmitter,
  useLiveData,
  getCurrentUser,
} from '@/lib/db'

interface Worker {
  id: string
  name: string
  job: string | null
  type: string
}

interface Production {
  id: string
  workerId: string
  date: string
  modelName: string
  quantity: number
  unitPrice: number
  total: number
  notes: string | null
  worker: Worker
}

export function ProductionView({ onBack }: { onBack: () => void }) {
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  // تحميل الإنتاج + الموظفين مع التحديث الفوري
  const { data: loadedData, loading, reload } = useLiveData<{
    productions: Production[]
    workers: Worker[]
  }>(async () => {
    const [prodsData, workersData] = await Promise.all([
      productionRepository.getByDateRange(from || undefined, to || undefined),
      workerRepository.getAll(),
    ])
    const workersList: Worker[] = workersData.map((w) => ({
      id: w.id,
      name: w.name,
      job: w.job ?? null,
      type: w.type,
    }))
    const workerMap = new Map(workersList.map((w) => [w.id, w]))
    let prods: Production[] = prodsData
      .map((p) => {
        const w = workerMap.get(p.workerId)
        if (!w) return null
        return {
          id: p.id,
          workerId: p.workerId,
          date: p.date,
          modelName: p.modelName,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          total: p.total,
          notes: p.notes ?? null,
          worker: w,
        } as Production
      })
      .filter((x): x is Production => x !== null)

    if (search) {
      const q = search.toLowerCase()
      prods = prods.filter(
        (p) =>
          p.modelName.toLowerCase().includes(q) ||
          p.worker?.name.toLowerCase().includes(q)
      )
    }
    return { productions: prods, workers: workersList }
  }, ['production', 'workers'])

  // إعادة التحميل عند تغير الفلاتر
  useEffect(() => {
    reload()
  }, [from, to, search, reload])

  const productions = loadedData?.productions || []
  const workers = loadedData?.workers || []

  const handleDelete = async (id: string) => {
    if (!confirm('حذف سجل الإنتاج؟')) return
    if (!perms.canDelete) { alert('ليس لديك صلاحية الحذف'); return }
    try {
      await productionRepository.delete(id)
      dataChangeEmitter.notifyDelete('production')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const totalAmount = productions.reduce((s, p) => s + p.total, 0)
  const totalPieces = productions.reduce((s, p) => s + p.quantity, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">الإنتاج بالقطعة</h2>
            <p className="text-xs text-slate-500">تسجيل إنتاج عمال الإنتاجية</p>
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          تسجيل إنتاج
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
          <p className="text-[10px] text-indigo-700">إجمالي القطع المنتجة</p>
          <p className="text-sm font-bold text-indigo-900">{totalPieces} قطعة</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] text-emerald-700">إجمالي المستحق للعمال</p>
          <p className="text-sm font-bold text-emerald-900">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث برقم الموديل أو اسم الموظف..."
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
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : productions.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Scissors className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد إنتاج مسجل</p>
          <p className="text-xs text-slate-400">ابدأ بتسجيل إنتاج موظف</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productions.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-indigo-500" />
                  <p className="font-bold text-slate-800 text-sm">{p.modelName}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-medium text-purple-700">{p.worker?.name}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(p.date)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  {p.quantity} قطعة × {formatCurrency(p.unitPrice)} ={' '}
                  <span className="font-bold text-emerald-700">{formatCurrency(p.total)}</span>
                </p>
                {p.notes && (
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.notes}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-rose-500"
                onClick={() => handleDelete(p.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ProductionForm
        open={open}
        onOpenChange={setOpen}
        workers={workers}
        onSaved={() => setOpen(false)}
      />
    </div>
  )
}

function ProductionForm({
  open,
  onOpenChange,
  workers,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  workers: Worker[]
  onSaved: () => void
}) {
  const [workerId, setWorkerId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [modelName, setModelName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0)

  const save = async () => {
    if (!workerId) {
      toast({ title: 'تنبيه', description: 'اختر الموظف', variant: 'destructive' })
      return
    }
    if (!modelName.trim() || !quantity || !unitPrice) {
      toast({ title: 'تنبيه', description: 'أكمل بيانات الإنتاج', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await productionRepository.createWithCalculation({
        workerId,
        date,
        modelName,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        notes: notes || undefined,
      })
      dataChangeEmitter.notifyCreate('production')
      toast({ title: 'تم', description: 'تم تسجيل الإنتاج' })
      setWorkerId('')
      setModelName('')
      setQuantity('')
      setUnitPrice('')
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
          <DialogTitle className="text-right">تسجيل إنتاج جديد</DialogTitle>
          <DialogDescription className="sr-only">تسجيل إنتاج الموظفين بالقطعة</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">الموظف *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} {w.job ? `- ${w.job}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">اسم الموديل / الصنف *</Label>
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="مثال: تيشيرت قطن، بنطلون جينز..."
              className="bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الكمية (عدد القطع) *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">سعر القطعة *</Label>
              <Input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="bg-slate-50"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-50" />
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-indigo-700">الإجمالي المستحق</span>
            <span className="text-lg font-bold text-indigo-900">{formatCurrency(total)}</span>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

