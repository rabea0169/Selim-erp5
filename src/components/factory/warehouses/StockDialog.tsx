'use client'

import { useState, useEffect } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react'
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
import { formatCurrency } from '@/lib/format'
import {
  materialRepository,
  dataChangeEmitter,
  type Material,
} from '@/lib/db'

interface StockDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  material: Material
  mode: 'add' | 'consume' | 'adjust'
  onSaved: () => void
}

export function StockDialog({
  open,
  onOpenChange,
  material,
  mode,
  onSaved,
}: StockDialogProps) {
  const isAdd = mode === 'add'
  const isAdjust = mode === 'adjust'
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reason, setReason] = useState(isAdd ? 'شراء' : isAdjust ? 'تسوية جرد' : 'استهلاك')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // reset عند فتح النموذج
  useEffect(() => {
    if (open) {
      setQuantity(isAdjust ? String(material.quantity ?? 0) : '')
      setUnitCost(String(material.unitCost || ''))
      setReason(isAdd ? 'شراء' : isAdjust ? 'تسوية جرد' : 'استهلاك')
      setNotes('')
    }
  }, [open, material.id, material.quantity, material.unitCost, isAdd, isAdjust])

  const save = async () => {
    const num = Number(quantity)
    if (isAdjust) {
      if (quantity === '' || isNaN(num) || num < 0) {
        toast({ title: 'أدخل رصيداً صحيحاً (صفر أو أكثر)', variant: 'destructive' })
        return
      }
    } else if (!num || num <= 0) {
      toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' })
      return
    }
    if (isAdd && (!unitCost || Number(unitCost) < 0)) {
      toast({ title: 'أدخل تكلفة الوحدة', variant: 'destructive' })
      return
    }
    if (!isAdd && !isAdjust && num > material.quantity) {
      toast({
        title: 'الكمية المطلوبة أكبر من المتاح',
        description: `المتاح: ${material.quantity} ${material.unit}`,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      if (isAdd) {
        await materialRepository.addStock(
          material.id,
          num,
          Number(unitCost) || 0,
          reason,
          notes.trim() || undefined
        )
      } else if (isAdjust) {
        await materialRepository.adjustStock(
          material.id,
          num,
          reason,
          notes.trim() || undefined
        )
      } else {
        await materialRepository.consumeStock(
          material.id,
          num,
          reason,
          undefined,
          undefined,
          notes.trim() || undefined
        )
      }
      dataChangeEmitter.notifyCreate('materialTransactions')
      dataChangeEmitter.notifyUpdate('materials')
      toast({
        title: isAdd ? 'تم إضافة الكمية' : isAdjust ? 'تمت تسوية الرصيد' : 'تم سحب الكمية',
        description: `${num} ${material.unit}`,
      })
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const title = isAdd ? 'إضافة كمية' : isAdjust ? 'تسوية رصيد' : 'سحب كمية'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            {isAdd ? (
              <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
            ) : isAdjust ? (
              <Scale className="w-5 h-5 text-blue-600" />
            ) : (
              <ArrowUpFromLine className="w-5 h-5 text-rose-600" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة المخازن والمواد</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">{material.name}</p>
              <p className="text-[11px] text-slate-500">
                الكمية الحالية: {material.quantity} {material.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">التكلفة</p>
              <p className="text-xs font-bold text-slate-700">
                {formatCurrency(material.unitCost)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">
                {isAdjust ? 'الرصيد الجديد *' : 'الكمية *'}
              </Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className={`bg-slate-50 font-bold ${
                  isAdd
                    ? 'text-emerald-700'
                    : isAdjust
                      ? 'text-blue-700'
                      : 'text-rose-700'
                }`}
              />
            </div>
            {isAdd && (
              <div>
                <Label className="text-xs">تكلفة الوحدة</Label>
                <Input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="bg-slate-50"
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">السبب</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {isAdd ? (
                  <>
                    <SelectItem value="شراء">شراء</SelectItem>
                    <SelectItem value="مرتجع">مرتجع</SelectItem>
                    <SelectItem value="تحويل">تحويل من مخزن</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </>
                ) : isAdjust ? (
                  <>
                    <SelectItem value="تسوية جرد">تسوية جرد</SelectItem>
                    <SelectItem value="تالف">تالف</SelectItem>
                    <SelectItem value="خطأ إدخال">خطأ إدخال</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="استهلاك">استهلاك</SelectItem>
                    <SelectItem value="إنتاج">صرف للإنتاج</SelectItem>
                    <SelectItem value="مرتجع للعميل">مرتجع للعميل</SelectItem>
                    <SelectItem value="تالف">تالف</SelectItem>
                    <SelectItem value="تحويل">تحويل لمخزن</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="bg-slate-50 text-sm"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-9 text-xs font-medium"
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className={`text-white h-9 text-xs font-medium ${
              isAdd
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : isAdjust
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {saving ? 'جارٍ الحفظ...' : isAdd ? 'إضافة' : isAdjust ? 'تسوية' : 'سحب'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
