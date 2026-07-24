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
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  productRepository,
  dataChangeEmitter,
  type Product,
} from '@/lib/db'

interface ProductFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editProduct: Product | null
  onSaved: () => void
}

export function ProductForm({ open, onOpenChange, editProduct, onSaved }: ProductFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('قطعة')
  const [wholesalePrice, setWholesalePrice] = useState('')
  const [halfWholesalePrice, setHalfWholesalePrice] = useState('')
  const [retailPrice, setRetailPrice] = useState('')
  const [cost, setCost] = useState('')
  const [quantity, setQuantity] = useState('0')
  const [reorderLevel, setReorderLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // تحميل بيانات التعديل
  useEffect(() => {
    if (open) {
      if (editProduct) {
        setName(editProduct.name)
        setCategory(editProduct.category || '')
        setUnit(editProduct.unit || 'قطعة')
        setWholesalePrice(String(editProduct.wholesalePrice || ''))
        setHalfWholesalePrice(String(editProduct.halfWholesalePrice || ''))
        setRetailPrice(String(editProduct.retailPrice || ''))
        setCost(String(editProduct.cost || ''))
        setQuantity(String(editProduct.quantity || 0))
        setReorderLevel(editProduct.reorderLevel ? String(editProduct.reorderLevel) : '')
        setNotes(editProduct.notes || '')
      } else {
        reset()
      }
    }
  }, [open, editProduct?.id])

  const reset = () => {
    setName('')
    setCategory('')
    setUnit('قطعة')
    setWholesalePrice('')
    setHalfWholesalePrice('')
    setRetailPrice('')
    setCost('')
    setQuantity('0')
    setReorderLevel('')
    setNotes('')
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'أدخل اسم المنتج', variant: 'destructive' })
      return
    }
    if (!cost || Number(cost) <= 0) {
      toast({ title: 'أدخل التكلفة', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || undefined,
        unit: unit.trim() || 'قطعة',
        wholesalePrice: Number(wholesalePrice) || 0,
        halfWholesalePrice: Number(halfWholesalePrice) || 0,
        retailPrice: Number(retailPrice) || 0,
        cost: Number(cost) || 0,
        quantity: Number(quantity) || 0,
        reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
        notes: notes.trim() || undefined,
      }
      if (editProduct) {
        await productRepository.update(editProduct.id, payload)
        dataChangeEmitter.notifyUpdate('products')
        toast({ title: 'تم تحديث المنتج' })
      } else {
        await productRepository.create(payload)
        dataChangeEmitter.notifyCreate('products')
        toast({ title: 'تم إضافة المنتج' })
      }
      reset()
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // اقتراح الأسعار بناءً على التكلفة
  const suggestPrices = () => {
    const c = Number(cost) || 0
    if (c <= 0) return
    Promise.resolve().then(() => {
      setWholesalePrice(String((c * 1.15).toFixed(2)))
      setHalfWholesalePrice(String((c * 1.25).toFixed(2)))
      setRetailPrice(String((c * 1.4).toFixed(2)))
    })
    toast({ title: 'تم اقتراح الأسعار (15%, 25%, 40%)' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editProduct ? 'تعديل المنتج' : 'منتج جديد'}
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة المنتجات وأسعارها</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اسم المنتج *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قميص قطن"
              className="bg-slate-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الفئة</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="مثال: ملابس رجالي"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">الوحدة</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="قطعة / زوج"
                className="bg-slate-50"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">التكلفة *</Label>
              <button
                type="button"
                onClick={suggestPrices}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                اقتراح الأسعار
              </button>
            </div>
            <Input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="bg-rose-50 font-bold text-rose-700"
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <p className="text-[10px] font-bold text-slate-600">الأسعار</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-slate-500">جملة</Label>
                <Input
                  type="number"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  placeholder="0"
                  className="bg-white text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">نصف جملة</Label>
                <Input
                  type="number"
                  value={halfWholesalePrice}
                  onChange={(e) => setHalfWholesalePrice(e.target.value)}
                  placeholder="0"
                  className="bg-white text-xs h-8"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500">قطاعي</Label>
                <Input
                  type="number"
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  placeholder="0"
                  className="bg-white text-xs h-8"
                />
              </div>
            </div>
            {Number(cost) > 0 && Number(retailPrice) > 0 && (
              <p className="text-[10px] text-emerald-700 font-bold">
                ربح القطاعي: {formatCurrency(Number(retailPrice) - Number(cost))} (
                {(((Number(retailPrice) - Number(cost)) / Number(cost)) * 100).toFixed(0)}%)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الكمية</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">حد إعادة الطلب</Label>
              <Input
                type="number"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="اختياري"
                className="bg-slate-50"
              />
            </div>
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-xs font-medium"
          >
            {saving ? 'جارٍ الحفظ...' : editProduct ? 'حفظ التعديلات' : 'حفظ المنتج'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
