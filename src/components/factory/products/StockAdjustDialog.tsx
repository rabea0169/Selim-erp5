'use client'

import { useState, useEffect } from 'react'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'
import {
  productRepository,
  dataChangeEmitter,
  type Product,
} from '@/lib/db'

interface StockAdjustDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

// تعديل رصيد يدوي (إضافة / صرف) — يستدعي POST /api/products/[id]/stock
export function StockAdjustDialog({ product, open, onOpenChange, onSaved }: StockAdjustDialogProps) {
  const [type, setType] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setType('in')
      setQuantity('')
      setReason('')
    }
  }, [open, product?.id])

  if (!product) return null

  const save = async () => {
    const qty = Number(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast({ title: 'أدخل كمية صحيحة أكبر من صفر', variant: 'destructive' })
      return
    }
    if (type === 'out' && qty > product.quantity) {
      toast({
        title: `الكمية المتاحة (${product.quantity}) أقل من المطلوب صرفه`,
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const finalReason = reason.trim() || (type === 'in' ? 'تعديل رصيد يدوي — إضافة' : 'تعديل رصيد يدوي — صرف')
      if (type === 'in') {
        await productRepository.addStock(product.id, qty, finalReason)
      } else {
        await productRepository.consumeStock(product.id, qty, finalReason)
      }
      dataChangeEmitter.notifyUpdate('products')
      toast({ title: type === 'in' ? 'تمت إضافة الرصيد' : 'تم صرف الرصيد' })
      onOpenChange(false)
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">تعديل رصيد — {product.name}</DialogTitle>
          <DialogDescription className="text-right text-xs">
            الرصيد الحالي: {formatNumber(product.quantity)} {product.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('in')}
              className={`flex items-center justify-center gap-1 rounded-lg border p-2 text-xs font-bold transition-colors ${
                type === 'in'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              إضافة رصيد
            </button>
            <button
              type="button"
              onClick={() => setType('out')}
              className={`flex items-center justify-center gap-1 rounded-lg border p-2 text-xs font-bold transition-colors ${
                type === 'out'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" />
              صرف رصيد
            </button>
          </div>
          <div>
            <Label className="text-xs">الكمية *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min="0"
              className="bg-slate-50"
            />
            {type === 'out' && (
              <p className="text-[10px] text-slate-400 mt-1">
                المتاح للصرف: {formatNumber(product.quantity)} {product.unit}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs">السبب</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تسوية جرد، تلف، عينة..."
              className="bg-slate-50"
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
            className={`h-9 text-xs font-medium text-white ${
              type === 'in'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {saving ? 'جارٍ الحفظ...' : type === 'in' ? 'إضافة' : 'صرف'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
