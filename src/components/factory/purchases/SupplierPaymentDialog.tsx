'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { paymentRepository, purchaseRepository, dataChangeEmitter, type Purchase } from '@/lib/db'

interface SupplierPaymentDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  purchase: Purchase
}

export function SupplierPaymentDialog({ open, onOpenChange, purchase }: SupplierPaymentDialogProps) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card'>('transfer')
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { toast } = useToast()

  const remaining = purchase.total - purchase.paid

  useEffect(() => {
    if (open) {
      setAmount(String(remaining))
      setMethod('transfer')
      setDate(todayStr())
      setNotes('')
      setError('')
    }
  }, [open, remaining])

  const save = async () => {
    const amountNum = Number(amount) || 0
    
    // التحقق من البيانات
    if (amountNum <= 0) {
      setError('أدخل مبلغاً صحيحاً')
      toast({ title: 'تنبيه', description: 'أدخل مبلغاً صحيحاً', variant: 'destructive' })
      return
    }
    
    if (amountNum > remaining) {
      setError(`المبلغ أكبر من المتبقي (${formatCurrency(remaining)})`)
      toast({ 
        title: 'تنبيه', 
        description: `المبلغ أكبر من المتبقي (${formatCurrency(remaining)})`, 
        variant: 'destructive' 
      })
      return
    }
    
    setSaving(true)
    setError('')
    
    try {
      if (purchase.supplierId_ref) {
        // مورد مسجل: POST /api/payments
        const response = await paymentRepository.create({
          type: 'supplier_payment',
          supplierId: purchase.supplierId_ref,
          partyId: purchase.supplierId_ref,
          partyName: purchase.supplierName,
          invoiceId: purchase.id,
          invoiceNo: purchase.invoiceNo,
          amount: amountNum,
          date,
          method,
          notes: notes || undefined,
        })
        
        // التحقق من الاستجابة
        if (!response || response.error) {
          throw new Error(response?.error || 'فشل تسجيل الدفعة')
        }
      } else {
        // مورد غير مسجل: تحديث مباشر
        const response = await purchaseRepository.update(purchase.id, { paid: purchase.paid + amountNum } as any)
        
        if (!response || response.error) {
          throw new Error(response?.error || 'فشل تحديث الفاتورة')
        }
      }
      
      // تحديث البيانات
      dataChangeEmitter.notifyUpdate('purchases')
      dataChangeEmitter.notifyUpdate('payments')
      dataChangeEmitter.notifyUpdate('treasuryTransactions')
      
      toast({
        title: 'تم',
        description: `تم دفع ${formatCurrency(amountNum)} للمورد ${purchase.supplierName}`,
      })
      
      onOpenChange(false)
    } catch (e: any) {
      const errorMsg = e.message || 'حدث خطأ في تسجيل الدفعة'
      setError(errorMsg)
      toast({ 
        title: 'خطأ', 
        description: errorMsg, 
        variant: 'destructive' 
      })
    } finally {
      setSaving(false)
    }
  }

  const methodLabels: Record<string, string> = {
    cash: 'كاش',
    transfer: 'تحويل بنكي',
    card: 'بطاقة',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto" 
        dir="rtl" 
        variant="bottom-sheet"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 text-lg sm:text-xl">
            دفع فاتورة للمورد {purchase.supplierName}
          </DialogTitle>
          <DialogDescription className="sr-only">تسجيل دفعة للمورد</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1 pb-2">
          {/* ملخص الفاتورة - Responsive */}
          <div className="bg-blue-50 rounded-lg p-3 sm:p-4 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-600">رقم الفاتورة:</span>
              <Badge variant="outline" className="text-xs sm:text-sm">{purchase.invoiceNo}</Badge>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-600">الإجمالي:</span>
              <span className="font-semibold text-sm sm:text-base">{formatCurrency(purchase.total)}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-600">المدفوع:</span>
              <span className="text-amber-600 font-semibold text-sm sm:text-base">{formatCurrency(purchase.paid)}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-600">المتبقي:</span>
              <span className="text-blue-600 font-bold text-sm sm:text-base">{formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-xs sm:text-sm">
              {error}
            </div>
          )}

          {/* نموذج الإدخال - Responsive */}
          <div className="space-y-3">
            {/* المبلغ */}
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs sm:text-sm">
                المبلغ المراد دفعه <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="أدخل المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
                className="text-sm sm:text-base"
              />
              <div className="text-xs text-slate-500">
                الحد الأقصى: {formatCurrency(remaining)}
              </div>
            </div>

            {/* طريقة الدفع */}
            <div className="space-y-1.5">
              <Label htmlFor="method" className="text-xs sm:text-sm">
                طريقة الدفع
              </Label>
              <Select value={method} onValueChange={(v: any) => setMethod(v)} disabled={saving}>
                <SelectTrigger id="method" className="text-sm sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="cash">كاش</SelectItem>
                  <SelectItem value="transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* التاريخ */}
            <div className="space-y-1.5">
              <Label htmlFor="date" className="text-xs sm:text-sm">
                التاريخ
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                className="text-sm sm:text-base"
              />
            </div>

            {/* ملاحظات */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs sm:text-sm">
                ملاحظات
              </Label>
              <Textarea
                id="notes"
                placeholder="أضف ملاحظات إضافية (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={saving}
                rows={3}
                className="text-sm sm:text-base resize-none"
              />
            </div>
          </div>
        </div>

        {/* الأزرار - Responsive */}
        <DialogFooter className="flex gap-2 sm:gap-3 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الدفعة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
