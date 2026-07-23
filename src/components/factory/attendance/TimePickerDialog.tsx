'use client'

import { Clock, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { formatDate } from '@/lib/format'
import { currentTimeStr } from './helpers'

export interface TimeDialogState {
  open: boolean
  workerId: string
  workerName: string
  type: 'checkIn' | 'checkOut'
  time: string
  notes: string
  existingId?: string
}

interface TimePickerDialogProps {
  state: TimeDialogState
  onChange: (next: TimeDialogState) => void
  date: string
  onSave: () => void
}

/**
 * نافذة اختيار الوقت يدوياً (ساعة/دقيقة) - للحضور والانصراف
 */
export function TimePickerDialog({ state, onChange, date, onSave }: TimePickerDialogProps) {
  const isCheckIn = state.type === 'checkIn'

  // أزرار الوقت السريع
  const quickTimes = [
    { label: 'الوقت الحالي', value: currentTimeStr() },
    { label: '8:00 ص', value: '08:00' },
    { label: '9:00 ص', value: '09:00' },
    { label: '2:00 م', value: '14:00' },
    { label: '4:00 م', value: '16:00' },
    { label: '5:00 م', value: '17:00' },
    { label: '6:00 م', value: '18:00' },
  ]

  // قائمة الساعات (24 ساعة)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0')
    const period = i < 12 ? 'ص' : 'م'
    const display12 = i === 0 ? 12 : i > 12 ? i - 12 : i
    return { value: h, label: `${h} (${display12} ${period})` }
  })

  // قائمة الدقائق (كل 5 دقائق)
  const minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

  const hourValue = state.time.split(':')[0]
  const minuteValue = state.time.split(':')[1] || '00'

  return (
    <Dialog
      open={state.open}
      onOpenChange={(v) => onChange({ ...state, open: v })}
    >
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isCheckIn ? (
              <>
                <LogIn className="w-5 h-5 text-emerald-600" />
                تسجيل حضور - {state.workerName}
              </>
            ) : (
              <>
                <LogOut className="w-5 h-5 text-blue-600" />
                تسجيل انصراف - {state.workerName}
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
              {quickTimes.map((q) => (
                <button
                  key={q.label}
                  onClick={() => onChange({ ...state, time: q.value })}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    state.time === q.value
                      ? isCheckIn
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
                  value={hourValue}
                  onValueChange={(h) =>
                    onChange({ ...state, time: `${h}:${minuteValue}` })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="ساعة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {hours.map((h) => (
                      <SelectItem key={h.value} value={h.value}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">الدقيقة</Label>
                <Select
                  value={minuteValue}
                  onValueChange={(m) =>
                    onChange({ ...state, time: `${hourValue || '08'}:${m}` })
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="دقيقة" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* عرض الوقت المختار */}
            <div
              className={`mt-3 p-3 rounded-lg text-center ${
                isCheckIn ? 'bg-emerald-100' : 'bg-blue-100'
              }`}
            >
              <p className="text-[10px] text-slate-600 mb-0.5">الوقت المختار</p>
              <p
                className={`text-2xl font-bold ${
                  isCheckIn ? 'text-emerald-700' : 'text-blue-700'
                }`}
              >
                {state.time}
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
              value={state.notes}
              onChange={(e) => onChange({ ...state, notes: e.target.value })}
              placeholder="مثال: تأخير، استئذان..."
              className="bg-slate-50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onChange({ ...state, open: false })}
          >
            إلغاء
          </Button>
          <Button
            onClick={onSave}
            className={
              isCheckIn
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          >
            {isCheckIn ? 'حفظ الحضور' : 'حفظ الانصراف'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
