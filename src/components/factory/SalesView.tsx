'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, X, Search, ShoppingCart, Calendar, Users } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate, todayStr } from '@/lib/format'
import { saleRepository, customerRepository, type Sale, type Customer } from '@/lib/db'
import { CustomersView } from './CustomersView'
import { PrintButton } from './PrintButton'

export function SalesView() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showCustomers, setShowCustomers] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [salesData, customersData] = await Promise.all([
        saleRepository.search(search, from || undefined, to || undefined),
        customerRepository.getAll(),
      ])
      setSales(salesData)
      setCustomers(customersData)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, from, to])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return
    try {
      await saleRepository.delete(id)
      load()
    } catch (e: any) {
      console.error(e)
    }
  }

  const totalSales = sales.reduce((s, x) => s + x.total, 0)
  const totalPaid = sales.reduce((s, x) => s + x.paid, 0)
  const totalRemaining = totalSales - totalPaid

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المبيعات</h2>
          <p className="text-xs text-slate-500">إدارة فواتير المبيعات</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCustomers(true)}
            className="border-slate-200"
          >
            <Users className="w-4 h-4 ml-1" />
            العملاء
          </Button>
          <Button
            onClick={() => setOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 ml-1" />
            فاتورة جديدة
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
          <p className="text-sm font-bold text-emerald-900">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-[10px] text-blue-700">المحصل</p>
          <p className="text-sm font-bold text-blue-900">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p className="text-[10px] text-amber-700">المتبقي</p>
          <p className="text-sm font-bold text-amber-900">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-slate-50 border-slate-200 text-sm" />
          </div>
        </div>
        {(from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }} className="text-xs text-slate-500">
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
      ) : sales.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
          <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد مبيعات مسجلة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sales.map((sale) => (
            <SaleCard key={sale.id} sale={sale} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <SaleForm
        open={open}
        onOpenChange={setOpen}
        onSaved={() => { setOpen(false); load() }}
        customers={customers}
      />

      {showCustomers && <CustomersView onBack={() => { setShowCustomers(false); load() }} />}
    </div>
  )
}

function SaleCard({ sale, onDelete }: { sale: Sale; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const remaining = sale.total - sale.paid

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-right"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-slate-800">{sale.customerName}</span>
            {sale.invoiceNo && (
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                #{sale.invoiceNo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3" />
            {formatDate(sale.date)}
          </div>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(sale.total)}</p>
          <p className="text-[10px] text-slate-500">{sale.items.length} صنف</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
          <div className="space-y-1">
            {sale.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-slate-100">
                <div>
                  <p className="font-medium text-slate-700">{it.itemName}</p>
                  <p className="text-[10px] text-slate-500">{it.quantity} × {formatCurrency(it.unitPrice)}</p>
                </div>
                <p className="font-bold text-slate-700">{formatCurrency(it.total)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-emerald-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-emerald-700">الإجمالي</p>
              <p className="font-bold text-emerald-900">{formatCurrency(sale.total)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-700">المدفوع</p>
              <p className="font-bold text-blue-900">{formatCurrency(sale.paid)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-700">المتبقي</p>
              <p className="font-bold text-amber-900">{formatCurrency(remaining)}</p>
            </div>
          </div>

          <PrintButton
            contentHtml={buildSalePrintHtml(sale)}
            title={`فاتورة مبيعات - ${sale.customerName}`}
            variant="outline"
            size="sm"
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            label="🖨️ طباعة الفاتورة"
          />

          <Button variant="ghost" size="sm" onClick={() => onDelete(sale.id)} className="text-rose-600 hover:bg-rose-50 w-full">
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف الفاتورة
          </Button>
        </div>
      )}
    </div>
  )
}

function SaleForm({
  open,
  onOpenChange,
  onSaved,
  customers,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
  customers: Customer[]
}) {
  const [customerName, setCustomerName] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayStr())
  const [paid, setPaid] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Array<{ itemName: string; quantity: number; unitPrice: number; total: number }>>([
    { itemName: '', quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [saving, setSaving] = useState(false)

  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0)

  const updateItem = (i: number, field: string, value: any) => {
    const newItems = [...items]
    ;(newItems[i] as any)[field] = value
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
    setItems([{ itemName: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  const selectCustomer = (id: string) => {
    setCustomerId(id)
    if (id) {
      const c = customers.find((x) => x.id === id)
      if (c) setCustomerName(c.name)
    }
  }

  const save = async () => {
    if (!customerName.trim()) return
    const validItems = items.filter((it) => it.itemName.trim())
    if (validItems.length === 0) return
    setSaving(true)
    try {
      await saleRepository.createWithItems({
        customerName,
        customerId_ref: customerId || undefined,
        invoiceNo,
        date,
        paid: Number(paid) || 0,
        notes,
        items: validItems.map((it) => ({
          itemName: it.itemName,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      })
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
        <DialogHeader>
          <DialogTitle className="text-right">فاتورة مبيعات جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">الأصناف</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems([...items, { itemName: '', quantity: 1, unitPrice: 0, total: 0 }])}
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
                    placeholder="اسم الصنف / الموديل"
                    value={it.itemName}
                    onChange={(e) => updateItem(i, 'itemName', e.target.value)}
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
                    <div className="h-8 px-2 flex items-center bg-emerald-50 rounded-md text-xs font-bold text-emerald-700">
                      {formatCurrency(it.total)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-l from-emerald-500 to-teal-600 text-white rounded-lg p-3 flex items-center justify-between">
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
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function buildSalePrintHtml(sale: Sale): string {
  const itemsRows = sale.items
    .map((it, i) => `<tr><td style="padding: 4px 6px; border: 1px solid #000; text-align: center;">${i + 1}</td><td style="padding: 4px 6px; border: 1px solid #000;">${it.itemName}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: center;">${it.quantity}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left;">${formatCurrency(it.unitPrice)}</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold;">${formatCurrency(it.total)}</td></tr>`)
    .join('')
  return `
    <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
      <h1 style="margin: 0; font-size: 18px;">فاتورة مبيعات</h1>
      <p style="margin: 4px 0 0; font-size: 11px;">مصنع الملابس</p>
    </div>
    <table style="width: 100%; font-size: 12px; margin-bottom: 12px;">
      <tr><td style="padding: 2px 0;">العميل:</td><td style="font-weight: bold;">${sale.customerName}</td></tr>
      ${sale.invoiceNo ? `<tr><td style="padding: 2px 0;">رقم الفاتورة:</td><td>${sale.invoiceNo}</td></tr>` : ''}
      <tr><td style="padding: 2px 0;">التاريخ:</td><td>${formatDate(sale.date)}</td></tr>
    </table>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      <thead><tr style="background: #f0f0f0;"><th style="padding: 6px; border: 1px solid #000;">#</th><th style="padding: 6px; border: 1px solid #000;">الصنف</th><th style="padding: 6px; border: 1px solid #000;">كمية</th><th style="padding: 6px; border: 1px solid #000;">سعر</th><th style="padding: 6px; border: 1px solid #000;">إجمالي</th></tr></thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr style="background: #f8f8f8;"><td colspan="4" style="padding: 6px; border: 1px solid #000; text-align: left; font-weight: bold;">الإجمالي:</td><td style="padding: 6px; border: 1px solid #000; text-align: left; font-weight: bold; color: #059669;">${formatCurrency(sale.total)}</td></tr>
        <tr><td colspan="4" style="padding: 4px 6px; border: 1px solid #000; text-align: left;">المدفوع:</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left;">${formatCurrency(sale.paid)}</td></tr>
        <tr><td colspan="4" style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold;">المتبقي:</td><td style="padding: 4px 6px; border: 1px solid #000; text-align: left; font-weight: bold; color: #d97706;">${formatCurrency(sale.total - sale.paid)}</td></tr>
      </tfoot>
    </table>
    <div style="margin-top: 16px; padding-top: 8px; border-top: 1px dashed #000; text-align: center; font-size: 10px; color: #666;">شكراً لتعاملكم معنا</div>
  `
}
