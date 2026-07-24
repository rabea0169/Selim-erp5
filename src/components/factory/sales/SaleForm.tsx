'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
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
import { formatCurrency, todayStr } from '@/lib/format'
import { saleRepository, productRepository, dataChangeEmitter, type Customer, type Product } from '@/lib/db'

interface SaleFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  customers: Customer[]
}

interface SaleFormItem {
  productName: string
  productId?: string
  priceType: 'wholesale' | 'half_wholesale' | 'retail' | 'custom'
  quantity: number
  unitPrice: number
  total: number
}

export function SaleForm({ open, onOpenChange, onSaved, customers }: SaleFormProps) {
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SaleFormItem[]>([
    { productName: '', priceType: 'custom', quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const { toast } = useToast()

  // تحميل المنتجات
  useEffect(() => {
    if (open) {
      productRepository.getAll().then(setProducts).catch(() => {})
    }
  }, [open])

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const updateItem = (i: number, field: keyof SaleFormItem, value: any) => {
    const newItems = [...items]
    ;(newItems[i] as any)[field] = value
    newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
    setItems(newItems)
  }

  // اختيار منتج من القائمة
  const selectProduct = (i: number, productId: string) => {
    if (productId === '__none__') {
      updateItem(i, 'productId', undefined)
      updateItem(i, 'productName', '')
      updateItem(i, 'unitPrice', 0)
      updateItem(i, 'priceType', 'custom')
      return
    }
    const product = products.find((p) => p.id === productId)
    if (product) {
      const newItems = [...items]
      newItems[i].productName = product.name
      newItems[i].productId = product.id
      newItems[i].priceType = 'retail'
      newItems[i].unitPrice = product.retailPrice
      newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
      setItems(newItems)
    }
  }

  // تغيير نوع السعر
  const changePriceType = (i: number, priceType: string) => {
    const item = items[i]
    if (!item.productId) {
      // لو مش مربوط بمنتج، خليه custom
      updateItem(i, 'priceType', 'custom')
      return
    }
    const product = products.find((p) => p.id === item.productId)
    if (!product) return

    const newItems = [...items]
    newItems[i].priceType = priceType as SaleFormItem['priceType']
    switch (priceType) {
      case 'wholesale':
        newItems[i].unitPrice = product.wholesalePrice
        break
      case 'half_wholesale':
        newItems[i].unitPrice = product.halfWholesalePrice
        break
      case 'retail':
        newItems[i].unitPrice = product.retailPrice
        break
    }
    newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
    setItems(newItems)
  }

  const reset = () => {
    setCustomerName('')
    setCustomerId('')
    setInvoiceNo('')
    setDate(todayStr())
    setPaid('')
    setNotes('')
    setItems([{ productName: '', priceType: 'custom', quantity: 1, unitPrice: 0, total: 0 }])
  }

  const selectCustomer = (id: string) => {
    setCustomerId(id)
    if (id && id !== '__none__') {
      const c = customers.find((x) => x.id === id)
      if (c) setCustomerName(c.name)
    }
  }

  const save = async () => {
    if (!customerName.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم العميل', variant: 'destructive' })
      return
    }
    const validItems = items.filter((it) => it.productName.trim())
    if (validItems.length === 0) {
      toast({ title: 'تنبيه', description: 'أضف صنفاً واحداً على الأقل', variant: 'destructive' })
      return
    }
    // التحقق من الكميات
    for (const it of validItems) {
      if (it.quantity <= 0) {
        toast({ title: 'تنبيه', description: 'الكمية يجب أن تكون موجبة', variant: 'destructive' })
        return
      }
      if (it.unitPrice < 0) {
        toast({ title: 'تنبيه', description: 'السعر يجب أن يكون موجباً', variant: 'destructive' })
        return
      }
    }
    setSaving(true)
    try {
      await saleRepository.createWithItems({
        customerName,
        customerId_ref: (customerId && customerId !== '__none__') ? customerId : undefined,
        invoiceNo,
        date,
        paid: Number(paid) || 0,
        notes,
        items: validItems.map((it) => ({
          itemName: it.productName,
          productId: it.productId,
          priceType: it.priceType,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      })
      dataChangeEmitter.notifyCreate('sales')
      dataChangeEmitter.notifyUpdate('products')
      dataChangeEmitter.notifyUpdate('treasuryTransactions')
      reset()
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">فاتورة مبيعات جديدة</DialogTitle>
          <DialogDescription className="sr-only">فاتورة مبيعات جديدة</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* اختيار العميل */}
          <div>
            <Label className="text-xs">اختر عميل مسجل (اختياري)</Label>
            <Select value={customerId || '__none__'} onValueChange={selectCustomer}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="أو اكتب اسم العميل يدوياً" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون —</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">اسم العميل *</Label>
              <Input
                value={customerName}
                onChange={(e) => { setCustomerName(e.target.value); setCustomerId('') }}
                placeholder="اسم العميل"
                className="bg-slate-50"
              />
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

          {/* الأصناف */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">الأصناف</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { productName: '', priceType: 'custom', quantity: 1, unitPrice: 0, total: 0 }])}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة صنف
              </Button>
            </div>

            {items.map((it, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-2">
                {/* اختيار المنتج */}
                <div className="flex items-center gap-2">
                  {products.length > 0 && (
                    <Select
                      value={it.productId || '__none__'}
                      onValueChange={(v) => selectProduct(i, v)}
                    >
                      <SelectTrigger className="bg-white text-sm h-8 w-9 shrink-0" title="اختيار منتج">
                        <Package className="w-3.5 h-3.5" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— يدوي —</SelectItem>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} (متاح: {p.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    placeholder="اسم الصنف / الموديل"
                    value={it.productName}
                    onChange={(e) => updateItem(i, 'productName', e.target.value)}
                    className="bg-white text-sm h-8"
                  />
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

                {/* نوع السعر + الكمية + السعر */}
                <div className="grid grid-cols-4 gap-1">
                  <div>
                    <Label className="text-[10px]">نوع السعر</Label>
                    <Select
                      value={it.priceType}
                      onValueChange={(v) => changePriceType(i, v)}
                      disabled={!it.productId}
                    >
                      <SelectTrigger className="bg-white text-sm h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wholesale">جملة</SelectItem>
                        <SelectItem value="half_wholesale">نصف جملة</SelectItem>
                        <SelectItem value="retail">قطاعي</SelectItem>
                        <SelectItem value="custom">مخصص</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">الكمية</Label>
                    <Input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="bg-white text-sm h-8" min="1" />
                  </div>
                  <div>
                    <Label className="text-[10px]">سعر الوحدة</Label>
                    <Input type="number" value={it.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} className="bg-white text-sm h-8" min="0" />
                  </div>
                  <div>
                    <Label className="text-[10px]">الإجمالي</Label>
                    <div className="h-8 px-2 flex items-center bg-emerald-50 rounded-md text-xs font-bold text-emerald-700">
                      {formatCurrency(it.total)}
                    </div>
                  </div>
                </div>

                {/* عرض مخزون المنتج */}
                {it.productId && (() => {
                  const p = products.find((x) => x.id === it.productId)
                  if (!p) return null
                  return (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-500">المتاح: {p.quantity} {p.unit}</span>
                      {p.quantity < it.quantity && (
                        <span className="text-rose-600 font-bold">⚠️ الكمية المطلوبة أكبر من المتاح!</span>
                      )}
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* الإجمالي + الأجل */}
          <div className="bg-gradient-to-l from-emerald-500 to-teal-600 text-white rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">الإجمالي الكلي</span>
              <span className="text-lg font-bold">{formatCurrency(total)}</span>
            </div>
            {Number(paid) > 0 && Number(paid) < total && (
              <div className="flex items-center justify-between text-xs bg-white/10 rounded px-2 py-1">
                <span>المتبقي (آجل)</span>
                <span className="font-bold">{formatCurrency(total - (Number(paid) || 0))}</span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." className="bg-slate-50 text-sm" rows={2} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
