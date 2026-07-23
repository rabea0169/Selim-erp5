'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, X, Search, Package, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr } from '@/lib/format'

interface PurchaseItem {
  id?: string
  itemName: string
  quantity: number
  unitPrice: number
  total: number
}

interface Purchase {
  id: string
  invoiceNo: string | null
  supplierName: string
  date: string
  total: number
  paid: number
  notes: string | null
  items: PurchaseItem[]
}

export function PurchasesView() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/purchases?${params.toString()}`).then((r) => r.json())
      setPurchases(res.purchases || [])
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل المشتريات', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, from, to])

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    try {
      await fetch(`/api/purchases/${id}`, { method: 'DELETE' })
      toast({ title: 'تم الحذف', description: 'تم حذف الفاتورة' })
      load()
    } catch {
      toast({ title: 'خطأ', description: 'فشل الحذف', variant: 'destructive' })
    }
  }

  const totalPurchases = purchases.reduce((s, x) => s + x.total, 0)
  const totalPaid = purchases.reduce((s, x) => s + x.paid, 0)
  const totalRemaining = totalPurchases - totalPaid

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المشتريات</h2>
          <p className="text-xs text-slate-500">إدارة فواتير المشتريات من الموردين</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
        >
          <Plus className="w-4 h-4 ml-1" />
          فاتورة جديدة
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-[10px] text-amber-700">إجمالي المشتريات</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(totalPurchases)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-[10px] text-blue-700">المدفوع</p>
          <p className="text-sm font-bold text-blue-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
          <p className="text-[10px] text-rose-700">المتبقي للموردين</p>
          <p className="text-sm font-bold text-rose-900">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المورد أو رقم الفاتورة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-slate-50 border-slate-200 text-sm"
            />
          </div>
        </div>
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom('')
              setTo('')
            }}
            className="text-xs text-slate-500"
          >
            <X className="w-3 h-3 ml-1" />
            مسح الفلترة
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مشتريات مسجلة</p>
          <p className="text-xs text-slate-400">ابدأ بإضافة فاتورة جديدة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {purchases.map((p) => (
            <PurchaseCard key={p.id} purchase={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <PurchaseForm
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          setOpen(false)
          load()
        }}
      />
    </div>
  )
}

function PurchaseCard({
  purchase,
  onDelete,
}: {
  purchase: Purchase
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const remaining = purchase.total - purchase.paid

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-right"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-slate-800">{purchase.supplierName}</span>
            {purchase.invoiceNo && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                #{purchase.invoiceNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3" />
            {formatDate(purchase.date)}
          </div>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-amber-700">
            {formatCurrency(purchase.total)}
          </p>
          <p className="text-[10px] text-slate-500">{purchase.items.length} صنف</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
          <div className="space-y-1">
            {purchase.items.map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-slate-100"
              >
                <div>
                  <p className="font-medium text-slate-700">{it.itemName}</p>
                  <p className="text-[10px] text-slate-500">
                    {it.quantity} × {formatCurrency(it.unitPrice)}
                  </p>
                </div>
                <p className="font-bold text-slate-700">{formatCurrency(it.total)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-700">الإجمالي</p>
              <p className="font-bold text-amber-900">{formatCurrency(purchase.total)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-700">المدفوع</p>
              <p className="font-bold text-blue-900">{formatCurrency(purchase.paid)}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-rose-700">المتبقي</p>
              <p className="font-bold text-rose-900">{formatCurrency(remaining)}</p>
            </div>
          </div>

          {purchase.notes && (
            <div className="bg-yellow-50 rounded-lg p-2 text-xs text-slate-700">
              <span className="font-bold">ملاحظات: </span>
              {purchase.notes}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(purchase.id)}
            className="text-rose-600 hover:bg-rose-50 w-full"
          >
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف الفاتورة
          </Button>
        </div>
      )}
    </div>
  )
}

function PurchaseForm({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [supplierName, setSupplierName] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([
    { itemName: '', quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const updateItem = (i: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items]
    ;(newItems[i] as any)[field] = value
    newItems[i].total = newItems[i].quantity * newItems[i].unitPrice
    setItems(newItems)
  }

  const addItem = () =>
    setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, total: 0 }])

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const reset = () => {
    setSupplierName('')
    setInvoiceNo('')
    setDate(todayStr())
    setPaid('')
    setNotes('')
    setItems([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  const save = async () => {
    if (!supplierName.trim()) {
      toast({ title: 'تنبيه', description: 'أدخل اسم المورد', variant: 'destructive' })
      return
    }
    const validItems = items.filter((it) => it.itemName.trim())
    if (validItems.length === 0) {
      toast({ title: 'تنبيه', description: 'أضف صنفاً واحداً على الأقل', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName,
          invoiceNo,
          date,
          paid: Number(paid) || 0,
          notes,
          items: validItems.map((it) => ({
            itemName: it.itemName,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }),
      }).then((r) => r.json())

      if (res.error) throw new Error(res.error)

      toast({ title: 'تم الحفظ', description: 'تم تسجيل فاتورة المشتريات' })
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
          <DialogTitle className="text-right">فاتورة مشتريات جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">اسم المورد *</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
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
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label className="text-xs">المدفوع</Label>
              <Input
                type="number"
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                placeholder="0"
                className="bg-slate-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">الأصناف</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="h-7 text-xs"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة صنف
              </Button>
            </div>

            {items.map((it, i) => (
              <div key={i} className="bg-slate-50 rounded-lg p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="اسم الصنف / الخامة"
                    value={it.itemName}
                    onChange={(e) => updateItem(i, 'itemName', e.target.value)}
                    className="bg-white text-sm h-8"
                  />
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(i)}
                      className="h-8 w-8 text-rose-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div>
                    <Label className="text-[10px]">الكمية</Label>
                    <Input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                      className="bg-white text-sm h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">سعر الوحدة</Label>
                    <Input
                      type="number"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                      className="bg-white text-sm h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">الإجمالي</Label>
                    <div className="h-8 px-2 flex items-center bg-amber-50 rounded-md text-xs font-bold text-amber-700">
                      {formatCurrency(it.total)}
                    </div>
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
          >
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
