'use client'

import { useEffect, useState } from 'react'
import {
  Calendar,
  Clock,
  LogIn,
  LogOut,
  Trash2,
  Users,
  X,
  CheckCircle,
  XCircle,
  CalendarOff,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatDateTime, todayStr, formatDate } from '@/lib/format'

interface Worker {
  id: string
  name: string
  job: string | null
  type: string
}

interface Attendance {
  id: string
  workerId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  notes: string | null
  worker: Worker
}

// الحصول على الوقت الحالي بصيغة HH:MM
function currentTimeStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// استخراج الوقت بصيغة HH:MM من تاريخ ISO
function timeFromISO(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// دمج التاريخ والوقت في ISO
function combineDateTime(dateStr: string, timeStr: string): string {
  const d = new Date(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

export function AttendanceView({ onBack }: { onBack: () => void }) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const { toast } = useToast()

  // حالة نافذة اختيار الوقت
  const [timeDialog, setTimeDialog] = useState<{
    open: boolean
    workerId: string
    workerName: string
    type: 'checkIn' | 'checkOut'
    time: string
    notes: string
    existingId?: string
  }>({
    open: false,
    workerId: '',
    workerName: '',
    type: 'checkIn',
    time: currentTimeStr(),
    notes: '',
  })

  // حالة نافذة الغياب/الإجازة
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean
    workerId: string
    workerName: string
    status: 'absent' | 'leave'
    notes: string
  }>({
    open: false,
    workerId: '',
    workerName: '',
    status: 'absent',
    notes: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [wRes, aRes] = await Promise.all([
        fetch('/api/workers').then((r) => r.json()),
        fetch(`/api/attendance?date=${date}`).then((r) => r.json()),
      ])
      setWorkers(wRes.workers || [])
      setRecords(aRes.attendance || [])
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // فتح نافذة اختيار وقت الحضور
  const openCheckInDialog = (worker: Worker) => {
    const rec = getRecord(worker.id)
    setTimeDialog({
      open: true,
      workerId: worker.id,
      workerName: worker.name,
      type: 'checkIn',
      time: rec?.checkIn ? timeFromISO(rec.checkIn) : currentTimeStr(),
      notes: rec?.notes || '',
      existingId: rec?.id,
    })
  }

  // فتح نافذة اختيار وقت الانصراف
  const openCheckOutDialog = (worker: Worker) => {
    const rec = getRecord(worker.id)
    setTimeDialog({
      open: true,
      workerId: worker.id,
      workerName: worker.name,
      type: 'checkOut',
      time: rec?.checkOut ? timeFromISO(rec.checkOut) : currentTimeStr(),
      notes: rec?.notes || '',
      existingId: rec?.id,
    })
  }

  // حفظ الوقت المختار
  const saveTime = async () => {
    const { workerId, type, time, notes, existingId } = timeDialog
    if (!time) {
      toast({ title: 'تنبيه', description: 'اختر الوقت', variant: 'destructive' })
      return
    }

    const dateTimeISO = combineDateTime(date, time)
    const payload: any = {
      workerId,
      date,
      notes,
    }
    if (type === 'checkIn') {
      payload.checkIn = dateTimeISO
      payload.status = 'present'
    } else {
      payload.checkOut = dateTimeISO
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      toast({
        title: 'تم',
        description: type === 'checkIn' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف',
      })
      setTimeDialog({ ...timeDialog, open: false })
      load()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  // حفظ حالة الغياب/الإجازة
  const saveStatus = async () => {
    const { workerId, status, notes } = statusDialog
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          date,
          status,
          notes,
        }),
      }).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      toast({ title: 'تم', description: status === 'absent' ? 'تم تسجيل الغياب' : 'تم تسجيل الإجازة' })
      setStatusDialog({ ...statusDialog, open: false })
      load()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    try {
      await fetch(`/api/attendance/${id}`, { method: 'DELETE' })
      toast({ title: 'تم الحذف' })
      load()
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const getRecord = (workerId: string) =>
    records.find((r) => r.workerId === workerId)

  const presentCount = records.filter((r) => r.status === 'present').length
  const absentCount = records.filter((r) => r.status === 'absent').length
  const leaveCount = records.filter((r) => r.status === 'leave').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
            <X className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">الحضور والانصراف</h2>
            <p className="text-xs text-slate-500">تسجيل حضور وانصراف العمال يومياً</p>
          </div>
        </div>
      </div>

      {/* Date selector */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-50 border-slate-200 text-sm max-w-[200px]"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center">
          <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-[10px] text-emerald-700">حاضر</p>
          <p className="text-lg font-bold text-emerald-900">{presentCount}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100 text-center">
          <XCircle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
          <p className="text-[10px] text-rose-700">غائب</p>
          <p className="text-lg font-bold text-rose-900">{absentCount}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
          <CalendarOff className="w-5 h-5 text-amber-600 mx-auto mb-1" />
          <p className="text-[10px] text-amber-700">إجازة</p>
          <p className="text-lg font-bold text-amber-900">{leaveCount}</p>
        </div>
      </div>

      {/* Workers list for check-in/out */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا يوجد عمال مسجلين</p>
          <p className="text-xs text-slate-400">أضف عمالاً من قسم العمال أولاً</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workers.map((w) => {
            const rec = getRecord(w.id)
            const isCheckedIn = !!rec?.checkIn
            const isCheckedOut = !!rec?.checkOut
            return (
              <div
                key={w.id}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                      {w.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{w.name}</p>
                      <p className="text-[10px] text-slate-500">{w.job || 'عامل'}</p>
                    </div>
                  </div>
                  {rec && (
                    <Badge
                      variant="outline"
                      className={
                        rec.status === 'present'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : rec.status === 'absent'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }
                    >
                      {rec.status === 'present'
                        ? 'حاضر'
                        : rec.status === 'absent'
                        ? 'غائب'
                        : 'إجازة'}
                    </Badge>
                  )}
                </div>

                {rec && (rec.checkIn || rec.checkOut) && (
                  <div className="grid grid-cols-2 gap-2 mb-2 text-[11px]">
                    <button
                      onClick={() => openCheckInDialog(w)}
                      className="bg-emerald-50 rounded-lg p-2 flex items-center gap-2 text-right hover:bg-emerald-100 transition-colors"
                    >
                      <LogIn className="w-3 h-3 text-emerald-600" />
                      <div className="flex-1">
                        <p className="text-emerald-700">حضور</p>
                        <p className="font-bold text-emerald-900">
                          {rec.checkIn ? timeFromISO(rec.checkIn) : '--:--'}
                        </p>
                      </div>
                      <Pencil className="w-3 h-3 text-emerald-500" />
                    </button>
                    <button
                      onClick={() => openCheckOutDialog(w)}
                      className="bg-blue-50 rounded-lg p-2 flex items-center gap-2 text-right hover:bg-blue-100 transition-colors"
                    >
                      <LogOut className="w-3 h-3 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-blue-700">انصراف</p>
                        <p className="font-bold text-blue-900">
                          {rec.checkOut ? timeFromISO(rec.checkOut) : '--:--'}
                        </p>
                      </div>
                      <Pencil className="w-3 h-3 text-blue-500" />
                    </button>
                  </div>
                )}

                {rec?.notes && (
                  <p className="text-[11px] text-slate-600 bg-yellow-50 rounded p-1.5 mb-2">
                    {rec.notes}
                  </p>
                )}

                <div className="flex gap-1">
                  {!isCheckedIn && (
                    <Button
                      size="sm"
                      onClick={() => openCheckInDialog(w)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                    >
                      <LogIn className="w-3.5 h-3.5 ml-1" />
                      تسجيل حضور
                    </Button>
                  )}
                  {isCheckedIn && !isCheckedOut && (
                    <Button
                      size="sm"
                      onClick={() => openCheckOutDialog(w)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                    >
                      <LogOut className="w-3.5 h-3.5 ml-1" />
                      تسجيل انصراف
                    </Button>
                  )}
                  {isCheckedOut && (
                    <div className="flex-1 text-center text-xs text-slate-500 py-1.5">
                      اكتمل التسجيل اليوم
                    </div>
                  )}
                  {!isCheckedIn && !isCheckedOut && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatusDialog({
                            open: true,
                            workerId: w.id,
                            workerName: w.name,
                            status: 'absent',
                            notes: '',
                          })
                        }
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 text-xs"
                      >
                        غائب
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setStatusDialog({
                            open: true,
                            workerId: w.id,
                            workerName: w.name,
                            status: 'leave',
                            notes: '',
                          })
                        }
                        className="border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs"
                      >
                        إجازة
                      </Button>
                    </>
                  )}
                  {rec && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-rose-500"
                      onClick={() => handleDelete(rec.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* نافذة اختيار الوقت يدوياً */}
      <Dialog
        open={timeDialog.open}
        onOpenChange={(v) => setTimeDialog({ ...timeDialog, open: v })}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              {timeDialog.type === 'checkIn' ? (
                <>
                  <LogIn className="w-5 h-5 text-emerald-600" />
                  تسجيل حضور - {timeDialog.workerName}
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5 text-blue-600" />
                  تسجيل انصراف - {timeDialog.workerName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* الوقت اليدوي */}
            <div className="bg-slate-50 rounded-xl p-4">
              <Label className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                اختر الوقت (ساعة ودقيقة)
              </Label>

              {/* وقت سريع */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { label: 'الوقت الحالي', value: currentTimeStr() },
                  { label: '8:00 ص', value: '08:00' },
                  { label: '9:00 ص', value: '09:00' },
                  { label: '2:00 م', value: '14:00' },
                  { label: '4:00 م', value: '16:00' },
                  { label: '5:00 م', value: '17:00' },
                  { label: '6:00 م', value: '18:00' },
                ].map((q) => (
                  <button
                    key={q.label}
                    onClick={() => setTimeDialog({ ...timeDialog, time: q.value })}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      timeDialog.time === q.value
                        ? timeDialog.type === 'checkIn'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* اختيار يدوي للساعة والدقيقة */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-slate-500">الساعة</Label>
                  <Select
                    value={timeDialog.time.split(':')[0]}
                    onValueChange={(h) =>
                      setTimeDialog({
                        ...timeDialog,
                        time: `${h}:${timeDialog.time.split(':')[1] || '00'}`,
                      })
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="ساعة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Array.from({ length: 24 }, (_, i) => {
                        const h = String(i).padStart(2, '0')
                        const period = i < 12 ? 'ص' : 'م'
                        const display12 = i === 0 ? 12 : i > 12 ? i - 12 : i
                        return (
                          <SelectItem key={i} value={h}>
                            {h} ({display12} {period})
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-slate-500">الدقيقة</Label>
                  <Select
                    value={timeDialog.time.split(':')[1] || '00'}
                    onValueChange={(m) =>
                      setTimeDialog({
                        ...timeDialog,
                        time: `${timeDialog.time.split(':')[0] || '08'}:${m}`,
                      })
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="دقيقة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(
                        (m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* عرض الوقت المختار */}
              <div
                className={`mt-3 p-3 rounded-lg text-center ${
                  timeDialog.type === 'checkIn'
                    ? 'bg-emerald-100'
                    : 'bg-blue-100'
                }`}
              >
                <p className="text-[10px] text-slate-600 mb-0.5">الوقت المختار</p>
                <p
                  className={`text-2xl font-bold ${
                    timeDialog.type === 'checkIn' ? 'text-emerald-700' : 'text-blue-700'
                  }`}
                >
                  {timeDialog.time}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  يوم {formatDate(date)}
                </p>
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Input
                value={timeDialog.notes}
                onChange={(e) =>
                  setTimeDialog({ ...timeDialog, notes: e.target.value })
                }
                placeholder="مثال: تأخير، استئذان..."
                className="bg-slate-50"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTimeDialog({ ...timeDialog, open: false })}
            >
              إلغاء
            </Button>
            <Button
              onClick={saveTime}
              className={
                timeDialog.type === 'checkIn'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            >
              {timeDialog.type === 'checkIn' ? 'حفظ الحضور' : 'حفظ الانصراف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تسجيل الغياب/الإجازة */}
      <Dialog
        open={statusDialog.open}
        onOpenChange={(v) => setStatusDialog({ ...statusDialog, open: v })}
      >
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              {statusDialog.status === 'absent' ? (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  تسجيل غياب - {statusDialog.workerName}
                </>
              ) : (
                <>
                  <CalendarOff className="w-5 h-5 text-amber-600" />
                  تسجيل إجازة - {statusDialog.workerName}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div
              className={`p-3 rounded-lg ${
                statusDialog.status === 'absent'
                  ? 'bg-rose-50'
                  : 'bg-amber-50'
              }`}
            >
              <p className="text-xs text-slate-700">
                سيتم تسجيل{' '}
                <span className="font-bold">
                  {statusDialog.status === 'absent' ? 'غياب' : 'إجازة'}
                </span>{' '}
                للعامل <span className="font-bold">{statusDialog.workerName}</span> في يوم{' '}
                <span className="font-bold">{formatDate(date)}</span>
              </p>
            </div>
            <div>
              <Label className="text-xs">السبب / ملاحظات</Label>
              <Input
                value={statusDialog.notes}
                onChange={(e) =>
                  setStatusDialog({ ...statusDialog, notes: e.target.value })
                }
                placeholder={
                  statusDialog.status === 'absent'
                    ? 'سبب الغياب...'
                    : 'نوع الإجازة (مرضية / سنوية...)'
                }
                className="bg-slate-50"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setStatusDialog({ ...statusDialog, open: false })}
            >
              إلغاء
            </Button>
            <Button
              onClick={saveStatus}
              className={
                statusDialog.status === 'absent'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
            >
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
