'use client'

import { useState } from 'react'
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
import { todayStr } from '@/lib/format'
import { expenseRepository, dataChangeEmitter } from '@/lib/db'
import type { ExpenseCategory } from './types'

interface ExpenseFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: ExpenseCategory[]
  onSaved: () => void
}

export function ExpenseForm({ open, onOpenChange, categories, onSaved }: ExpenseFormProps) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const save = async () => {
    if (!categoryId) {
      toast({ title: 'تنبيه', description: 'اختر بند المصروف', variant: 'destructive' })
      return
    }
    if (!amount || Number(amount) <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await expenseRepository.createWithCategory({
        categoryId,
        amount: Number(amount),
        date,
        notes: notes || undefined,
      })
      dataChangeEmitter.notifyCreate('expenses')
      toast({ title: 'تم', description: 'تم تسجيل المصروف' })
      setCategoryId('')
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
          <DialogTitle className="text-right">مصروف جديد</DialogTitle>
          <DialogDescription className="sr-only">تسجيل مصروف جديد</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">بند المصروف *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر البند" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">المبلغ *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="bg-slate-50 border-rose-200"
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
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
