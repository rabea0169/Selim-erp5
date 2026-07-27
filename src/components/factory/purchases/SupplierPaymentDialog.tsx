'use client'

import { useState, useEffect } from 'react'
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
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
import { paymentRepository, dataChangeEmitter, type Purchase } from '@/lib/db'

interface SupplierPaymentDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  purchase: Purchase
}

export function SupplierPaymentDialog({ open, onOpenChange, purchase }: SupplierPaymentDialogProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('cash')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const remaining = purchase.total - purchase.paid

  useEffect(() => {
    if (open) {
      setAmount(String(remaining))
      setMethod('cash')
      setDate(todayStr())
      setNotes('')
    }
  }, [open, remaining])

  const save = async () => {
    const amountNum = Number(amount) || 0
    if (amountNum <= 0) {
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    if (amountNum > remaining) {
      toast({ title: 'تنبيه', description: `المبلغ أكبر من المتبقي (${formatCurrency(remaining)})`, variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await paymentRepository.create({
        type: 'supplier_payment',
        partyId: purchase.supplierId_ref || purchase.id,
        partyName: purchase.supplierName,
        invoiceId: purchase.id,
        invoiceNo: purchase.invoiceNo,
        amount: amountNum,
        date,
        method,
        notes: notes || undefined,
      })
      // تحديث المشتريات: زيادة المدفوع
      const { purchaseRepository } = await import('@/lib/db')
      await purchaseRepository.update(purchase.id, { paid: purchase.paid + amountNum } as any)
      dataChangeEmitter.notifyUpdate('purchases')
      dataChangeEmitter.notifyUpdate('payments')
      dataChangeEmitter.notifyUpdate('treasuryTransactions')
      toast({
        title: 'تم',
        description: `تم دفع ${formatCurrency(amountNum)} للمورد ${purchase.supplierName}`,
      })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl" variant="bottom-sheet">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-right">
            دفع للمورد: {purchase.supplierName}
          </DialogTitle>
          <DialogDescription className="sr-only">تسجيل دفعة للمورد</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-2">
          {/* ملخص الفاتورة */}
          <div className="bg-amber-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">فاتورة</span>
              <span className="font-bold text-slate-800">{purchase.invoiceNo || formatDate(purchase.date)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">إجمالي الفاتورة</span>
              <span className="font-bold text-amber-700">{formatCurrency(purchase.total)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">المدفوع سابقاً</span>
              <span className="font-bold text-blue-700">{formatCurrency(purchase.paid)}</span>
            </div>
            <div className="border-t border-amber-200 pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-700 font-bold">المتبقي</span>
              <span className="font-bold text-rose-700 text-base">{formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* المبلغ */}
          <div>
            <Label className="text-xs">مبلغ الدفع *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="bg-slate-50 text-lg font-bold"
              min="0"
              max={remaining}
            />
            <div className="flex justify-between mt-1">
              <button
                type="button"
                onClick={() => setAmount(String(remaining))}
                className="text-[10px] text-emerald-600 hover:underline"
              >
                دفع المتبقي كاملاً ({formatCurrency(remaining)})
              </button>
              {Number(amount) > 0 && (
                <span className="text-[10px] text-slate-500">
                  سيتبقى: {formatCurrency(Math.max(0, remaining - Number(amount)))}
                </span>
              )}
            </div>
          </div>

          {/* طريقة الدفع والتاريخ */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">طريقة الدفع</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">كاش</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-50"
              />
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات الدفعة..."
              className="bg-slate-50 text-sm"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 px-1 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving || !amount || Number(amount) <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : `دفع ${formatCurrency(Number(amount) || 0)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
