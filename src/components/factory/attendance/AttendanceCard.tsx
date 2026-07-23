'use client'

import {
  LogIn,
  LogOut,
  Trash2,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { timeFromISO, type Worker, type Attendance } from './helpers'

interface AttendanceCardProps {
  worker: Worker
  record?: Attendance
  onCheckIn: (worker: Worker) => void
  onCheckOut: (worker: Worker) => void
  onSetStatus: (worker: Worker, status: 'absent' | 'leave') => void
  onDelete: (id: string) => void
}

/**
 * بطاقة عامل مع أزرار الحضور/الانصراف والغياب/الإجازة والحذف
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            {worker.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{worker.name}</p>
            <p className="text-[10px] text-slate-500">{worker.job || 'عامل'}</p>
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
