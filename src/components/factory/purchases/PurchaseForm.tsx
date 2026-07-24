'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { formatCurrency, todayStr } from '@/lib/format'
import { purchaseRepository, dataChangeEmitter, type Supplier } from '@/lib/db'

interface PurchaseFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  suppliers: Supplier[]
}

export function PurchaseForm({ open, onOpenChange, onSaved, suppliers }: PurchaseFormProps) {
  const [supplierName, setSupplierName] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Array<{ itemName: string; quantity: number; unitPrice: number; total: number }>>([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }])
  const [saving, setSaving] = useState(false)

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items]
    ;(newItems[i] as any)[field] = value
    newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
    setItems(newItems)
  }

  const reset = () => {
    setSupplierName('')
    setSupplierId('')
    setInvoiceNo('')
    setDate(todayStr())
    setPaid('')
    setNotes('')
    setItems([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  const selectSupplier = (id: string) => {
    setSupplierId(id)
    if (id && id !== '__none__') {
      const s = suppliers.find((x) => x.id === id)
      if (s) setSupplierName(s.name)
    }
  }

  const save = async () => {
    if (!supplierName.trim()) return
    const validItems = items.filter((it) => it.itemName.trim())
    if (validItems.length === 0) return
    setSaving(true)
    try {
      await purchaseRepository.createWithItems({
        supplierName,
        supplierId_ref: (supplierId && supplierId !== '__none__') ? supplierId : undefined,
        invoiceNo,
        date,
        paid: Number(paid) || 0,
        notes,
        items: validItems.map((it) => ({ itemName: it.itemName, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
      })
      dataChangeEmitter.notifyCreate('purchases')
      reset()
      onSaved()
    } catch (e: any) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle className="text-right">فاتورة مشتريات جديدة</DialogTitle>
          <DialogDescription className="sr-only">فاتورة مشتريات جديدة</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">اختر مورد مسجل (اختياري)</Label>
            <Select value={supplierId || '__none__'} onValueChange={selectSupplier}>
              <SelectTrigger className="bg-slate-50"><SelectValue placeholder="أو اكتب اسم المورد يدوياً" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون —</SelectItem>
                {suppliers.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">اسم المورد *</Label>
              <Input value={supplierName} onChange={(e) => { setSupplierName(e.target.value); setSupplierId('') }} placeholder="اسم المورد" className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">رقم الفاتورة</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="رقم الفاتورة" className="bg-slate-50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-slate-50" />
            </div>
            <div>
              <Label className="text-xs">المدفوع</Label>
              <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="0" className="bg-slate-50" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">الأصناف</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, total: 0 }])} className="h-7 text-xs">
                <Plus className="w-3 h-3 ml-1" /> إضافة صنف
              </Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input placeholder="اسم الصنف / الخامة" value={it.itemName} onChange={(e) => updateItem(i, 'itemName', e.target.value)} className="bg-white text-sm h-8" />
                  {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="h-8 w-8 text-rose-600 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <Label className="text-[10px]">الكمية</Label>
                    <Input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="bg-white text-sm h-8" />
                  </div>
                  <div>
                    <Label className="text-[10px]">سعر الوحدة</Label>
                    <Input type="number" value={it.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} className="bg-white text-sm h-8" />
                  </div>
                  <div>
                    <Label className="text-[10px]">الإجمالي</Label>
                    <div className="h-8 px-2 flex items-center bg-amber-50 rounded-md text-xs font-bold text-amber-700">{formatCurrency(it.total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-gradient-to-l from-amber-500 to-orange-600 text-white rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm">الإجمالي الكلي</span>
            <span className="text-lg font-bold">{formatCurrency(total)}</span>
          </div>
          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="bg-slate-50 text-sm" rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
