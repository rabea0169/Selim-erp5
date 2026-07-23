'use client'

import { useState } from 'react'
import {
  ArrowDownCircle,
  ArrowUpCircle,
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
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { todayStr } from '@/lib/format'
import {
  workerAdvanceRepository,
  workerReceiptRepository,
  dataChangeEmitter,
} from '@/lib/db'
import type { WorkerWithStats } from './types'

interface TransactionFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  worker: WorkerWithStats
  type: 'advance' | 'receipt'
  onSaved: () => void
}

export function TransactionForm({
  open,
  onOpenChange,
  worker,
  type,
  onSaved,
}: TransactionFormProps) {
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
        dataChangeEmitter.notifyCreate('workerAdvances')
        toast({ title: 'تم', description: 'تم تسجيل السلفة' })
      } else {
        await workerReceiptRepository.create(payload)
        dataChangeEmitter.notifyCreate('workerReceipts')
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
