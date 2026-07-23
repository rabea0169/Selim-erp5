'use client'

import { useState, useEffect } from 'react'
import {
  Calendar,
  Users,
  X,
  CheckCircle,
  XCircle,
  CalendarOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { todayStr } from '@/lib/format'
import {
  workerRepository,
  workerAttendanceRepository,
  dataChangeEmitter,
  useLiveData,
  type WorkerAttendance,
} from '@/lib/db'
import { TimePickerDialog, type TimeDialogState } from './attendance/TimePickerDialog'
import { StatusDialog, type StatusDialogState } from './attendance/StatusDialog'
import { AttendanceCard } from './attendance/AttendanceCard'
import {
  currentTimeStr,
  timeFromISO,
  combineDateTime,
  type Worker,
  type Attendance,
} from './attendance/helpers'

export function AttendanceView({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState(todayStr())
  const { toast } = useToast()

  // تحميل العمال + سجلات الحضور مع التحديث الفوري
  const { data: loadedData, loading, reload } = useLiveData<{
    workers: Worker[]
    records: Attendance[]
  }>(async () => {
    const [workersData, attendanceData] = await Promise.all([
      workerRepository.getAll(),
      workerAttendanceRepository.getByDate(date),
    ])
    const workersList: Worker[] = workersData.map((w) => ({
      id: w.id,
      name: w.name,
      job: w.job ?? null,
      type: w.type,
    }))
    const workerMap = new Map(workersList.map((w) => [w.id, w]))
    const recs: Attendance[] = attendanceData
      .map((a) => {
        const w = workerMap.get(a.workerId)
        if (!w) return null
        return {
          id: a.id,
          workerId: a.workerId,
          date: a.date,
          checkIn: a.checkIn ?? null,
          checkOut: a.checkOut ?? null,
          status: a.status,
          notes: a.notes ?? null,
          worker: w,
        } as Attendance
      })
      .filter((x): x is Attendance => x !== null)
    return { workers: workersList, records: recs }
  }, ['workers', 'workerAttendance'])

  // إعادة التحميل عند تغير التاريخ
  useEffect(() => {
    reload()
  }, [date, reload])

  const workers = loadedData?.workers || []
  const records = loadedData?.records || []

  // حالة نافذة اختيار الوقت
  const [timeDialog, setTimeDialog] = useState<TimeDialogState>({
    open: false,
    workerId: '',
    workerName: '',
    type: 'checkIn',
    time: currentTimeStr(),
    notes: '',
  })

  // حالة نافذة الغياب/الإجازة
  const [statusDialog, setStatusDialog] = useState<StatusDialogState>({
    open: false,
    workerId: '',
    workerName: '',
    status: 'absent',
    notes: '',
  })

  const getRecord = (workerId: string) =>
    records.find((r) => r.workerId === workerId)

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

  // فتح نافذة الغياب/الإجازة
  const openStatusDialog = (worker: Worker, status: 'absent' | 'leave') => {
    setStatusDialog({
      open: true,
      workerId: worker.id,
      workerName: worker.name,
      status,
      notes: '',
    })
  }

  // حفظ الوقت المختار
  const saveTime = async () => {
    const { workerId, type, time, notes } = timeDialog
    if (!time) {
      toast({ title: 'تنبيه', description: 'اختر الوقت', variant: 'destructive' })
      return
    }

    const dateTimeISO = combineDateTime(date, time)
    const payload: Partial<WorkerAttendance> & { workerId: string; date: string } = {
      workerId,
      date: combineDateTime(date, '00:00'),
      notes: notes || undefined,
    }
    if (type === 'checkIn') {
      payload.checkIn = dateTimeISO
      payload.status = 'present'
    } else {
      payload.checkOut = dateTimeISO
      payload.status = 'present'
    }

    try {
      await workerAttendanceRepository.upsert(payload)
      dataChangeEmitter.notifyUpdate('workerAttendance')
      toast({
        title: 'تم',
        description: type === 'checkIn' ? 'تم تسجيل الحضور' : 'تم تسجيل الانصراف',
      })
      setTimeDialog({ ...timeDialog, open: false })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  // حفظ حالة الغياب/الإجازة
  const saveStatus = async () => {
    const { workerId, status, notes } = statusDialog
    try {
      await workerAttendanceRepository.upsert({
        workerId,
        date: combineDateTime(date, '00:00'),
        status,
        notes: notes || undefined,
      })
      dataChangeEmitter.notifyUpdate('workerAttendance')
      toast({ title: 'تم', description: status === 'absent' ? 'تم تسجيل الغياب' : 'تم تسجيل الإجازة' })
      setStatusDialog({ ...statusDialog, open: false })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return
    try {
      await workerAttendanceRepository.delete(id)
      dataChangeEmitter.notifyDelete('workerAttendance')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

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
          {workers.map((w) => (
            <AttendanceCard
              key={w.id}
              worker={w}
              record={getRecord(w.id)}
              onCheckIn={openCheckInDialog}
              onCheckOut={openCheckOutDialog}
              onSetStatus={openStatusDialog}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* نافذة اختيار الوقت يدوياً */}
      <TimePickerDialog
        state={timeDialog}
        onChange={setTimeDialog}
        date={date}
        onSave={saveTime}
      />

      {/* نافذة تسجيل الغياب/الإجازة */}
      <StatusDialog
        state={statusDialog}
        onChange={setStatusDialog}
        date={date}
        onSave={saveStatus}
      />
    </div>
  )
}
