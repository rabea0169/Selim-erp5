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
} from 'lucide-react'
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

export function AttendanceView({ onBack }: { onBack: () => void }) {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [selectedWorker, setSelectedWorker] = useState('')
  const [notes, setNotes] = useState('')
  const { toast } = useToast()

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

  const checkIn = async (workerId: string) => {
    try {
      const now = new Date()
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          date,
          checkIn: now.toISOString(),
          status: 'present',
        }),
      }).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      toast({ title: 'تم', description: 'تم تسجيل الحضور' })
      load()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const checkOut = async (workerId: string) => {
    try {
      const now = new Date()
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          date,
          checkOut: now.toISOString(),
        }),
      }).then((r) => r.json())
      if (res.error) throw new Error(res.error)
      toast({ title: 'تم', description: 'تم تسجيل الانصراف' })
      load()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const markStatus = async (workerId: string, status: string) => {
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
      toast({ title: 'تم', description: 'تم التحديث' })
      setNotes('')
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
                    <div className="bg-emerald-50 rounded-lg p-2 flex items-center gap-2">
                      <LogIn className="w-3 h-3 text-emerald-600" />
                      <div>
                        <p className="text-emerald-700">حضور</p>
                        <p className="font-bold text-emerald-900">
                          {rec.checkIn ? formatDateTime(rec.checkIn).split(' ').pop() : '--'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 flex items-center gap-2">
                      <LogOut className="w-3 h-3 text-blue-600" />
                      <div>
                        <p className="text-blue-700">انصراف</p>
                        <p className="font-bold text-blue-900">
                          {rec.checkOut ? formatDateTime(rec.checkOut).split(' ').pop() : '--'}
                        </p>
                      </div>
                    </div>
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
                      onClick={() => checkIn(w.id)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                    >
                      <LogIn className="w-3.5 h-3.5 ml-1" />
                      تسجيل حضور
                    </Button>
                  )}
                  {isCheckedIn && !isCheckedOut && (
                    <Button
                      size="sm"
                      onClick={() => checkOut(w.id)}
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
                  {!isCheckedIn && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markStatus(w.id, 'absent')}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 text-xs"
                      >
                        غائب
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markStatus(w.id, 'leave')}
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
    </div>
  )
}
