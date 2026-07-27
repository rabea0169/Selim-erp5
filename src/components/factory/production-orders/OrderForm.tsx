'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Layers,
  X,
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
  productionOrderRepository,
  dataChangeEmitter,
  type Product,
  type Material,
} from '@/lib/db'
import { DEFAULT_STAGES } from './types'

interface OrderFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: Product[]
  materials: Material[]
  onSaved: () => void
}

interface MaterialSelection {
  materialId: string
  quantity: number
}

export function OrderForm({
  open,
  onOpenChange,
  products,
  materials,
  onSaved,
}: OrderFormProps) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSelection[]>([])
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES)
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // reset عند الإغلاق
  useEffect(() => {
    if (!open) {
      // تأخير بسيط لتجنب flicker
      Promise.resolve().then(() => {
        setProductId('')
        setQuantity('1')
        setSelectedMaterials([])
        setStages(DEFAULT_STAGES)
        setExpectedEndDate('')
        setNotes('')
      })
    }
  }, [open])

  const selectedProduct = products.find((p) => p.id === productId)

  // المواد الخام المتاحة (في مخازن المواد الخام)
  const availableMaterials = materials

  const addMaterial = () => {
    setSelectedMaterials([
      ...selectedMaterials,
      { materialId: '', quantity: 1 },
    ])
  }

  const updateMaterial = (idx: number, field: 'materialId' | 'quantity', value: any) => {
    const updated = [...selectedMaterials]
    updated[idx] = { ...updated[idx], [field]: value }
    setSelectedMaterials(updated)
  }

  const removeMaterial = (idx: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== idx))
  }

  const addStage = () => {
    setStages([...stages, ''])
  }

  const updateStage = (idx: number, value: string) => {
    const updated = [...stages]
    updated[idx] = value
    setStages(updated)
  }

  const removeStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (!productId) {
      toast({ title: 'اختر المنتج', variant: 'destructive' })
      return
    }
    if (!selectedProduct) {
      toast({ title: 'المنتج غير موجود', variant: 'destructive' })
      return
    }
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' })
      return
    }

    // تحقق من المواد
    const validMaterials = selectedMaterials.filter((m) => m.materialId)
    for (const sm of validMaterials) {
      const mat = materials.find((m) => m.id === sm.materialId)
      if (!mat) {
        toast({ title: 'مادة غير موجودة', variant: 'destructive' })
        return
      }
      if (mat.quantity < sm.quantity * qty) {
        toast({
          title: `المادة ${mat.name} غير متاحة`,
          description: `متاح: ${mat.quantity} ${mat.unit} • مطلوب: ${sm.quantity * qty}`,
          variant: 'destructive',
        })
        return
      }
    }

    const validStages = stages.filter((s) => s.trim())

    setSaving(true)
    try {
      await productionOrderRepository.createOrder({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        unit: selectedProduct.unit,
        materials: validMaterials.map((sm) => {
          const mat = materials.find((m) => m.id === sm.materialId)!
          return {
            materialId: sm.materialId,
            materialName: mat.name,
            quantity: sm.quantity * qty,
            unit: mat.unit,
          }
        }),
        stages: validStages.map((name) => ({ name: name.trim() })),
        expectedEndDate: expectedEndDate || undefined,
        notes: notes.trim() || undefined,
      })
      dataChangeEmitter.notifyCreate('productionOrders')
      dataChangeEmitter.notifyUpdate('materials')
      dataChangeEmitter.notifyCreate('materialTransactions')
      toast({
        title: 'تم إنشاء أمر التشغيل',
        description: 'تم سحب المواد الخام من المخزن',
      })
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">أمر تشغيل جديد</DialogTitle>
          <DialogDescription className="sr-only">إدارة أوامر التشغيل</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {/* المنتج */}
          <div>
            <Label className="text-xs">المنتج *</Label>
            <Select
              value={productId || '__none__'}
              onValueChange={(v) => setProductId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر المنتج" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— اختر —</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (متاح: {p.quantity} {p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الكمية */}
          <div>
            <Label className="text-xs">الكمية المطلوبة *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="bg-slate-50 font-bold"
            />
            {selectedProduct && (
              <p className="text-[10px] text-slate-500 mt-1">
                التكلفة المتوقعة: {formatCurrency(selectedProduct.cost * (Number(quantity) || 0))}
              </p>
            )}
          </div>

          {/* المواد الخام */}
          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">المواد الخام</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMaterial}
                className="h-7 text-[11px] border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة مادة
              </Button>
            </div>
            {selectedMaterials.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-2">
                لا توجد مواد مضافة (يمكن الإضافة لاحقاً)
              </p>
            ) : (
              <div className="space-y-2">
                {selectedMaterials.map((sm, idx) => {
                  const mat = materials.find((m) => m.id === sm.materialId)
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-2 space-y-1.5 border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={sm.materialId || '__none__'}
                          onValueChange={(v) =>
                            updateMaterial(idx, 'materialId', v === '__none__' ? '' : v)
                          }
                        >
                          <SelectTrigger className="bg-slate-50 text-xs h-8 flex-1">
                            <SelectValue placeholder="اختر المادة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— اختر —</SelectItem>
                            {availableMaterials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} (متاح: {m.quantity} {m.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMaterial(idx)}
                          className="h-7 w-7 text-rose-500 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px]">الكمية لكل وحدة</Label>
                          <Input
                            type="number"
                            value={sm.quantity}
                            onChange={(e) =>
                              updateMaterial(idx, 'quantity', Number(e.target.value))
                            }
                            className="bg-slate-50 text-xs h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">الإجمالي</Label>
                          <div className="h-8 px-2 flex items-center bg-amber-50 rounded-md text-[11px] font-bold text-amber-700">
                            {sm.quantity * (Number(quantity) || 0)} {mat?.unit || ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* مراحل التصنيع */}
          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Layers className="w-3 h-3" />
                مراحل التصنيع
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStage}
                className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة مرحلة
              </Button>
            </div>
            <div className="space-y-1.5">
              {stages.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Input
                    value={s}
                    onChange={(e) => updateStage(idx, e.target.value)}
                    placeholder="اسم المرحلة"
                    className="bg-white text-xs h-8"
                  />
                  {stages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStage(idx)}
                      className="h-7 w-7 text-rose-500 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* تاريخ التسليم */}
          <div>
            <Label className="text-xs">تاريخ التسليم المتوقع</Label>
            <Input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className="bg-slate-50"
            />
          </div>

          {/* ملاحظات */}
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-medium"
          >
            {saving ? 'جارٍ الحفظ...' : 'إنشاء الأمر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
