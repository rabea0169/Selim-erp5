'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Search,
  Users,
  Phone,
  Briefcase,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  FileText,
  Calendar,
  Scissors,
  Clock,
  Contact,
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
import {
  workerRepository,
  workerAdvanceRepository,
  workerReceiptRepository,
  type Worker as WorkerType,
  type WorkerAdvance,
  type WorkerReceipt,
} from '@/lib/db'
import { WorkerReportModal } from './WorkerReportModal'
import { AttendanceView } from './AttendanceView'
import { ProductionView } from './ProductionView'
import { pickContactFromPhone, isContactsPickerSupported } from '@/lib/contacts'

type SubView = 'list' | 'attendance' | 'production'

interface Worker {
  id: string
  name: string
  phone: string | null
  job: string | null
  type: string
  notes: string | null
  advances: WorkerAdvance[]
  receipts: WorkerReceipt[]
  totalAdvances: number
  totalReceipts: number
  balance: number
}

export function WorkersView() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [subView, setSubView] = useState<SubView>('list')
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = search
        ? await workerRepository.search(search)
        : await workerRepository.getAllWithStats()
      // getAllWithStats returns workers with embedded advances/receipts/balance
      // search() returns plain Worker[] without stats, so normalize
      const normalized: Worker[] = await Promise.all(
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
      setWorkers(normalized)
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل العمال', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    if (subView === 'list') load()
  }, [load, subView])

  if (subView === 'attendance') {
    return <AttendanceView onBack={() => setSubView('list')} />
  }
  if (subView === 'production') {
    return <ProductionView onBack={() => setSubView('list')} />
  }

  const totalAdvances = workers.reduce((s, w) => s + w.totalAdvances, 0)
  const totalReceipts = workers.reduce((s, w) => s + w.totalReceipts, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">العمال</h2>
          <p className="text-xs text-slate-500">إدارة العمال والسلف والقبض</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4 ml-1" />
          عامل جديد
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
          بيانات العمال
        </button>
        <button
          onClick={() => setSubView('attendance')}
          className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
            subView === 'attendance'
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
            subView === 'production'
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
          <p className="text-[10px] text-purple-700">عدد العمال</p>
          <p className="text-sm font-bold text-purple-900">{workers.length}</p>
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
            placeholder="بحث باسم العامل أو الهاتف..."
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
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد عمال مسجلين</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workers.map((w) => (
            <WorkerCard key={w.id} worker={w} onChanged={load} />
          ))}
        </div>
      )}

      <WorkerForm
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false)
          load()
        }}
      />
    </div>
  )
}

function WorkerCard({
  worker,
  onChanged,
}: {
  worker: Worker
  onChanged: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const { toast } = useToast()

  const handleDeleteAdvance = async (id: string) => {
    if (!confirm('حذف هذه السلفة؟')) return
    try {
      await workerAdvanceRepository.delete(id)
      toast({ title: 'تم الحذف' })
      onChanged()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const handleDeleteReceipt = async (id: string) => {
    if (!confirm('حذف هذا القبض؟')) return
    try {
      await workerReceiptRepository.delete(id)
      toast({ title: 'تم الحذف' })
      onChanged()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const handleDeleteWorker = async () => {
    if (!confirm(`حذف العامل ${worker.name} وكل سجلاته؟`)) return
    try {
      await workerRepository.deleteWithRelations(worker.id)
      toast({ title: 'تم حذف العامل' })
      onChanged()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            {worker.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{worker.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {worker.job && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {worker.job}
                </span>
              )}
              {worker.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {worker.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left">
          <Badge
            variant="outline"
            className={
              worker.balance > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : worker.balance < 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-600'
            }
          >
            رصيد: {formatCurrency(worker.balance)}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-rose-50 rounded-lg p-2">
              <p className="text-[10px] text-rose-700">إجمالي السلف</p>
              <p className="font-bold text-rose-900">{formatCurrency(worker.totalAdvances)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-[10px] text-emerald-700">إجمالي القبض</p>
              <p className="font-bold text-emerald-900">{formatCurrency(worker.totalReceipts)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              onClick={() => setAdvanceOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 ml-1" />
              تسجيل سلفة
            </Button>
            <Button
              size="sm"
              onClick={() => setReceiptOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 ml-1" />
              تسجيل قبض
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => setReportOpen(true)}
            className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white h-8 text-xs"
          >
            <FileText className="w-3.5 h-3.5 ml-1" />
            تقرير العامل الكامل (PDF + واتساب)
          </Button>

          {/* Advances history */}
          {worker.advances.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">آخر السلف</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {worker.advances.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between bg-white rounded-lg p-2 text-xs border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-rose-700">- {formatCurrency(a.amount)}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(a.date)}
                        {a.notes && ` • ${a.notes}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-rose-500"
                      onClick={() => handleDeleteAdvance(a.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipts history */}
          {worker.receipts.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">آخر القبض</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {worker.receipts.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-white rounded-lg p-2 text-xs border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-emerald-700">+ {formatCurrency(r.amount)}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(r.date)}
                        {r.notes && ` • ${r.notes}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-rose-500"
                      onClick={() => handleDeleteReceipt(r.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {worker.notes && (
            <div className="bg-yellow-50 rounded-lg p-2 text-xs text-slate-700">
              <span className="font-bold">ملاحظات: </span>
              {worker.notes}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteWorker}
            className="text-rose-600 hover:bg-rose-50 w-full text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف العامل
          </Button>
        </div>
      )}

      <TransactionForm
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        worker={worker}
        type="advance"
        onSaved={() => {
          setAdvanceOpen(false)
          onChanged()
        }}
      />
      <TransactionForm
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        worker={worker}
        type="receipt"
        onSaved={() => {
          setReceiptOpen(false)
          onChanged()
        }}
      />
      {reportOpen && (
        <WorkerReportModal worker={worker} onClose={() => setReportOpen(false)} />
      )}
    </div>
  )
}

function WorkerForm({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [job, setJob] = useState('')
  const [type, setType] = useState<'monthly' | 'production'>('monthly')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const contactsSupported = isContactsPickerSupported()
  const { toast } = useToast()

  const pickFromContacts = async () => {
    setPicking(true)
    try {
      const contact = await pickContactFromPhone()
      if (contact) {
        if (contact.name) setName(contact.name)
        if (contact.phone) setPhone(contact.phone)
        toast({ title: 'تم', description: 'تم تعبئة البيانات من جهة الاتصال' })
      }
    } catch (e: any) {
      toast({ title: 'تعذر الاختيار', description: e.message, variant: 'destructive' })
    } finally {
      setPicking(false)
    }
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم العامل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await workerRepository.create({
        name,
        phone: phone || undefined,
        job: job || undefined,
        type,
        notes: notes || undefined,
      })
      toast({ title: 'تم', description: 'تمت إضافة العامل' })
      setName('')
      setPhone('')
      setJob('')
      setType('monthly')
      setNotes('')
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
          <DialogTitle className="text-right">عامل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {contactsSupported && (
            <Button
              type="button"
              variant="outline"
              onClick={pickFromContacts}
              disabled={picking}
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 bg-purple-50/50"
            >
              <Contact className="w-4 h-4 ml-2" />
              {picking ? 'جارٍ الفتح...' : 'اختيار من جهات الاتصال'}
            </Button>
          )}
          <div>
            <Label className="text-xs">اسم العامل *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الهاتف</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">الوظيفة</Label>
              <Input value={job} onChange={(e) => setJob(e.target.value)} className="bg-slate-50" placeholder="خياط / تفصيل..." />
            </div>
          </div>
          <div>
            <Label className="text-xs">نوع العامل</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'monthly' | 'production')}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">مرتب شهري</SelectItem>
                <SelectItem value="production">إنتاج بالقطعة</SelectItem>
              </SelectContent>
            </Select>
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
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({
  open,
  onOpenChange,
  worker,
  type,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  worker: Worker
  type: 'advance' | 'receipt'
  onSaved: () => void
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const isAdvance = type === 'advance'

  const save = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        workerId: worker.id,
        amount: Number(amount),
        date,
        notes: notes || undefined,
      }
      if (isAdvance) {
        await workerAdvanceRepository.create(payload)
        toast({ title: 'تم', description: 'تم تسجيل السلفة' })
      } else {
        await workerReceiptRepository.create(payload)
        toast({ title: 'تم', description: 'تم تسجيل القبض' })
      }
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
          <DialogTitle className="text-right flex items-center gap-2">
            {isAdvance ? (
              <>
                <ArrowDownCircle className="w-5 h-5 text-rose-600" />
                تسجيل سلفة - {worker.name}
              </>
            ) : (
              <>
                <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                تسجيل قبض - {worker.name}
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">المبلغ *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`bg-slate-50 ${isAdvance ? 'border-rose-200' : 'border-emerald-200'}`}
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
            className={
              isAdvance
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
