'use client'

import { XCircle, CalendarOff } from 'lucide-react'
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
import { formatDate } from '@/lib/format'

export interface StatusDialogState {
  open: boolean
  workerId: string
  workerName: string
  status: 'absent' | 'leave'
  notes: string
}

interface StatusDialogProps {
  state: StatusDialogState
  onChange: (next: StatusDialogState) => void
  date: string
  onSave: () => void
}

/**
 * نافذة تسجيل الغياب/الإجازة
 */
export function StatusDialog({ state, onChange, date, onSave }: StatusDialogProps) {
  const isAbsent = state.status === 'absent'

  return (
    <Dialog
      open={state.open}
      onOpenChange={(v) => onChange({ ...state, open: v })}
    >
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isAbsent ? (
              <>
                <XCircle className="w-5 h-5 text-rose-600" />
                تسجيل غياب - {state.workerName}
              </>
            ) : (
              <>
                <CalendarOff className="w-5 h-5 text-amber-600" />
                تسجيل إجازة - {state.workerName}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            className={`p-3 rounded-lg ${
              isAbsent ? 'bg-rose-50' : 'bg-amber-50'
            }`}
          >
            <p className="text-xs text-slate-700">
              سيتم تسجيل{' '}
              <span className="font-bold">
                {isAbsent ? 'غياب' : 'إجازة'}
              </span>{' '}
              للموظف <span className="font-bold">{state.workerName}</span> في يوم{' '}
              <span className="font-bold">{formatDate(date)}</span>
            </p>
          </div>
          <div>
            <Label className="text-xs">السبب / ملاحظات</Label>
            <Input
              value={state.notes}
              onChange={(e) => onChange({ ...state, notes: e.target.value })}
              placeholder={
                isAbsent
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
            onClick={() => onChange({ ...state, open: false })}
          >
            إلغاء
          </Button>
          <Button
            onClick={onSave}
            className={
              isAbsent
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }
          >
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
