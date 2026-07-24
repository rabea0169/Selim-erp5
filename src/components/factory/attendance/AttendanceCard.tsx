'use client'

import {
  LogIn,
  LogOut,
  Trash2,
  Pencil,
  Clock,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { timeFromISO, type Worker, type Attendance } from './helpers'
import { calculateAttendance, formatHours, formatMinutes } from '@/lib/attendance-calc'

interface AttendanceCardProps {
  worker: Worker
  record?: Attendance
  onCheckIn: (worker: Worker) => void
  onCheckOut: (worker: Worker) => void
  onSetStatus: (worker: Worker, status: 'absent' | 'leave') => void
  onDelete: (id: string) => void
}

/**
 * بطاقة موظف مع أزرار الحضور/الانصراف والغياب/الإجازة والحذف
 * تعرض الساعات المحسوبة والإضافي والتأخير لما يكون فيه checkIn و checkOut
 */
export function AttendanceCard({
  worker,
  record,
  onCheckIn,
  onCheckOut,
  onSetStatus,
  onDelete,
}: AttendanceCardProps) {
  const isCheckedIn = !!record?.checkIn
  const isCheckedOut = !!record?.checkOut

  // حساب الساعات لو فيه checkIn و checkOut
  let workHours: number | null = null
  let overtimeHours: number | null = null
  let lateMinutes: number | null = null

  if (record?.checkIn && record?.checkOut && record.status === 'present') {
    // استخدام القيم المخزنة لو موجودة، غير كذلك احسبها لحظياً
    if (record.workHours != null) {
      workHours = record.workHours
      overtimeHours = record.overtimeHours ?? 0
      lateMinutes = record.lateMinutes ?? 0
    } else {
      // حساب لحظي من checkIn و checkOut باستخدام بيانات الموظف
      const calc = calculateAttendance(record as any, worker as any)
      workHours = calc.workHours
      overtimeHours = calc.overtimeHours
      lateMinutes = calc.lateMinutes
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            {worker.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{worker.name}</p>
            <p className="text-[10px] text-slate-500">{worker.job || 'موظف'}</p>
          </div>
        </div>
        {record && (
          <Badge
            variant="outline"
            className={
              record.status === 'present'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : record.status === 'absent'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }
          >
            {record.status === 'present'
              ? 'حاضر'
              : record.status === 'absent'
              ? 'غائب'
              : 'إجازة'}
          </Badge>
        )}
      </div>

      {record && (record.checkIn || record.checkOut) && (
        <div className="grid grid-cols-2 gap-2 mb-2 text-[11px]">
          <button
            onClick={() => onCheckIn(worker)}
            className="bg-emerald-50 rounded-lg p-2 flex items-center gap-2 text-right hover:bg-emerald-100 transition-colors"
          >
            <LogIn className="w-3 h-3 text-emerald-600" />
            <div className="flex-1">
              <p className="text-emerald-700">حضور</p>
              <p className="font-bold text-emerald-900">
                {record.checkIn ? timeFromISO(record.checkIn) : '--:--'}
              </p>
            </div>
            <Pencil className="w-3 h-3 text-emerald-500" />
          </button>
          <button
            onClick={() => onCheckOut(worker)}
            className="bg-blue-50 rounded-lg p-2 flex items-center gap-2 text-right hover:bg-blue-100 transition-colors"
          >
            <LogOut className="w-3 h-3 text-blue-600" />
            <div className="flex-1">
              <p className="text-blue-700">انصراف</p>
              <p className="font-bold text-blue-900">
                {record.checkOut ? timeFromISO(record.checkOut) : '--:--'}
              </p>
            </div>
            <Pencil className="w-3 h-3 text-blue-500" />
          </button>
        </div>
      )}

      {/* عرض الساعات المحسوبة لما يكون فيه checkIn و checkOut */}
      {workHours != null && (
        <div className="grid grid-cols-3 gap-1.5 mb-2 text-[11px]">
          <div className="bg-slate-50 rounded-lg p-1.5 text-center border border-slate-100">
            <p className="text-[9px] text-slate-500 flex items-center justify-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              ساعات العمل
            </p>
            <p className="font-bold text-slate-800 text-[11px]">
              {formatHours(workHours)}
            </p>
          </div>
          {(overtimeHours ?? 0) > 0 && (
            <div className="bg-amber-50 rounded-lg p-1.5 text-center border border-amber-100">
              <p className="text-[9px] text-amber-700 flex items-center justify-center gap-0.5">
                <Clock className="w-2.5 h-2.5" />
                إضافي
              </p>
              <p className="font-bold text-amber-900 text-[11px]">
                {formatHours(overtimeHours ?? 0)}
              </p>
            </div>
          )}
          {(lateMinutes ?? 0) > 0 && (
            <div className="bg-rose-50 rounded-lg p-1.5 text-center border border-rose-100">
              <p className="text-[9px] text-rose-700 flex items-center justify-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5" />
                تأخير
              </p>
              <p className="font-bold text-rose-900 text-[11px]">
                {formatMinutes(lateMinutes ?? 0)}
              </p>
            </div>
          )}
        </div>
      )}

      {record?.notes && (
        <p className="text-[11px] text-slate-600 bg-yellow-50 rounded p-1.5 mb-2">
          {record.notes}
        </p>
      )}

      <div className="flex gap-1">
        {!isCheckedIn && (
          <Button
            size="sm"
            onClick={() => onCheckIn(worker)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
          >
            <LogIn className="w-3.5 h-3.5 ml-1" />
            تسجيل حضور
          </Button>
        )}
        {isCheckedIn && !isCheckedOut && (
          <Button
            size="sm"
            onClick={() => onCheckOut(worker)}
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
              onClick={() => onSetStatus(worker, 'absent')}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 h-8 text-xs"
            >
              غائب
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetStatus(worker, 'leave')}
              className="border-amber-200 text-amber-700 hover:bg-amber-50 h-8 text-xs"
            >
              إجازة
            </Button>
          </>
        )}
        {record && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-rose-500"
            onClick={() => onDelete(record.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
