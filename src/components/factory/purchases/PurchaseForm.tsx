'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
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
import { formatCurrency, todayStr } from '@/lib/format'
import {
  purchaseRepository,
  materialRepository,
  dataChangeEmitter,
  useLiveData,
  type Supplier,
  type Material,
  type Purchase,
} from '@/lib/db'

interface PurchaseFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  suppliers: Supplier[]
  editPurchase?: Purchase | null
}

interface PurchaseItemDraft {
  itemName: string
  materialId: string
  quantity: number
  unitPrice: number
  total: number
}

export function PurchaseForm({ open, onOpenChange, onSaved, suppliers, editPurchase }: PurchaseFormProps) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItemDraft[]>([
    { itemName: '', materialId: '', quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const isEdit = !!editPurchase

  // تحميل المواد الخام (من كل المخازن) - يتحدث تلقائياً عند تغيرها
  const { data: materialsData } = useLiveData<Material[]>(
    () => materialRepository.getAll(),
    ['materials']
  )

  const materials: Material[] = materialsData || []

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  // تعبئة الحقول عند فتح النموذج في وضع التعديل
  useEffect(() => {
    if (open && editPurchase) {
      setSupplierName(editPurchase.supplierName || '')
      setSupplierId(editPurchase.supplierId_ref || '')
      setInvoiceNo(editPurchase.invoiceNo || '')
      setDate(editPurchase.date ? String(editPurchase.date).slice(0, 10) : todayStr())
      setPaid(String(editPurchase.paid ?? ''))
      setNotes(editPurchase.notes || '')
      setItems(
        editPurchase.items.length > 0
          ? editPurchase.items.map((it) => ({
              itemName: it.itemName,
              materialId: it.materialId || '',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.quantity * it.unitPrice,
            }))
          : [{ itemName: '', materialId: '', quantity: 1, unitPrice: 0, total: 0 }]
      )
    }
  }, [open, editPurchase])

  const updateItem = (i: number, field: keyof PurchaseItemDraft, value: any) => {
    Promise.resolve().then(() => {
      setItems((prev) => {
        const newItems = [...prev]
        ;(newItems[i] as any)[field] = value
        newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
        return newItems
      })
    })
  }

  // ربط صنف بمادة خام موجودة
  const linkMaterial = (i: number, materialId: string) => {
    Promise.resolve().then(() => {
      setItems((prev) => {
        const newItems = [...prev]
        const mat = materials.find((m) => m.id === materialId)
        if (mat) {
          newItems[i].materialId = materialId
          // لو اسم الصنف فارغ - املأه باسم المادة
          if (!newItems[i].itemName.trim()) {
            newItems[i].itemName = mat.name
          }
          // لو سعر الوحدة صفر - استخدم آخر تكلفة معروفة
          if (!newItems[i].unitPrice || newItems[i].unitPrice === 0) {
            newItems[i].unitPrice = mat.unitCost || 0
          }
        } else {
          // لو اختار "بدون" - امسح الربط
          newItems[i].materialId = ''
        }
        newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
        return newItems
      })
    })
  }

  const reset = () => {
    setSupplierName('')
    setSupplierId('')
    setInvoiceNo('')
    setDate(todayStr())
    setPaid('')
    setNotes('')
    setItems([{ itemName: '', materialId: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  const selectSupplier = (id: string) => {
    setSupplierId(id)
    if (id && id !== '__none__') {
      const s = suppliers.find((x) => x.id === id)
      if (s) setSupplierName(s.name)
    }
  }

  const save = async () => {
    if (!supplierName.trim()) {
      toast({ title: 'أدخل اسم المورد', variant: 'destructive' })
      return
    }
    const validItems = items.filter((it) => it.itemName.trim())
    if (validItems.length === 0) {
      toast({ title: 'أضف صنفاً واحداً على الأقل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        supplierName,
        supplierId_ref: (supplierId && supplierId !== '__none__') ? supplierId : undefined,
        invoiceNo,
        date,
        paid: Number(paid) || 0,
        notes,
        items: validItems.map((it) => ({
          itemName: it.itemName,
          materialId: it.materialId || undefined,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      }

      if (isEdit && editPurchase) {
        await purchaseRepository.updateWithItems(editPurchase.id, payload)
      } else {
        await purchaseRepository.createWithItems(payload)
      }

      // إشعار التحديثات
      if (isEdit) {
        dataChangeEmitter.notifyUpdate('purchases')
      } else {
        dataChangeEmitter.notifyCreate('purchases')
      }
      // لو فيه أصناف مربوطة بمواد - إشعار المخازن
      const hasMaterialLinks = validItems.some((it) => it.materialId)
      if (hasMaterialLinks || isEdit) {
        dataChangeEmitter.notifyUpdate('materials')
        dataChangeEmitter.notifyUpdate('materialTransactions')
      }

      reset()
      onSaved()
      toast({
        title: isEdit ? 'تم تحديث الفاتورة' : 'تم حفظ الفاتورة',
        description: hasMaterialLinks || isEdit
          ? 'تم تحديث مخزون المواد الخام المرتبطة'
          : undefined,
      })
    } catch (e: any) {
      console.error(e)
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? 'تعديل فاتورة مشتريات' : 'فاتورة مشتريات جديدة'}</DialogTitle>
          <DialogDescription className="sr-only">{isEdit ? 'تعديل فاتورة مشتريات' : 'فاتورة مشتريات جديدة'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اختر مورد مسجل (اختياري)</Label>
            <Select value={supplierId || '__none__'} onValueChange={selectSupplier}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="أو اكتب اسم المورد يدوياً" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون —</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">اسم المورد *</Label>
              <Input
                value={supplierName}
                onChange={(e) => { setSupplierName(e.target.value); setSupplierId('') }}
                placeholder="اسم المورد"
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">رقم الفاتورة</Label>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="رقم الفاتورة"
                className="bg-slate-50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">المدفوع</Label>
              <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} onFocus={(e) => e.target.select()} placeholder="0" className="bg-slate-50" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">الأصناف</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { itemName: '', materialId: '', quantity: 1, unitPrice: 0, total: 0 }])}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 ml-1" /> إضافة صنف
              </Button>
            </div>
            {items.map((it, i) => {
              const linkedMaterial = it.materialId
                ? materials.find((m) => m.id === it.materialId)
                : null
              return (
                <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-2">
                  {/* صف اسم الصنف + زر اختيار المادة */}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="اسم الصنف / الخامة"
                      value={it.itemName}
                      onChange={(e) => updateItem(i, 'itemName', e.target.value)}
                      className="bg-white text-sm h-8"
                    />
                    {/* زر اختيار المادة الخام (Select مدمج) */}
                    <Select
                      value={it.materialId || '__none__'}
                      onValueChange={(v) => linkMaterial(i, v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="bg-white text-xs h-8 w-9 p-0 shrink-0 border-emerald-200" title="ربط بمادة خام">
                        <Package className={`w-4 h-4 mx-auto ${it.materialId ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— بدون ربط —</SelectItem>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.unit}) - متاح: {m.quantity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="h-8 w-8 text-rose-600 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* عرض بيانات المادة المرتبطة */}
                  {linkedMaterial && (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-md p-1.5 text-[10px] text-emerald-700">
                      <Package className="w-3 h-3 shrink-0" />
                      <span className="font-bold">{linkedMaterial.name}</span>
                      <Badge variant="outline" className="text-[9px] bg-white text-emerald-700 border-emerald-200">
                        {linkedMaterial.unit}
                      </Badge>
                      <span>آخر سعر: {formatCurrency(linkedMaterial.unitCost)}</span>
                      <span className="text-emerald-600">متاح: {linkedMaterial.quantity}</span>
                    </div>
                  )}

                  {/* صف الكمية/السعر/الإجمالي — فجوات أوسع وخلايا مرنة لمنع التداخل */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <Label className="text-[10px]">الكمية</Label>
                      <Input
                        type="number"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="bg-white text-sm h-8 w-full min-w-0 px-2"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-[10px]">سعر الوحدة</Label>
                      <Input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="bg-white text-sm h-8 w-full min-w-0 px-2"
                      />
                    </div>
                    <div className="min-w-0">
                      <Label className="text-[10px]">الإجمالي</Label>
                      <div className="h-8 px-2 flex items-center justify-center bg-amber-50 rounded-md text-xs font-bold text-amber-700 truncate">
                        {formatCurrency(it.total)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="bg-gradient-to-l from-amber-500 to-orange-600 text-white rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm">الإجمالي الكلي</span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
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
        {/* الأزرار: الإجراء الأساسي (حفظ) أولاً، ثم الإلغاء في النهاية */}
        <DialogFooter className="gap-2">
          <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
