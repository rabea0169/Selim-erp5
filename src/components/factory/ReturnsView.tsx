'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Trash2,
  RotateCcw,
  Package,
  ShoppingCart,
  Truck,
  X,
  Search,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
import {
  saleRepository,
  purchaseRepository,
  saleReturnRepository,
  purchaseReturnRepository,
  dataChangeEmitter,
  useLiveData,
  type Sale,
  type Purchase,
  type SaleReturn,
  type PurchaseReturn,
} from '@/lib/db'

type ReturnType = 'sale' | 'purchase'

interface ReturnItem {
  itemId: string
  itemName: string
  productId?: string
  materialId?: string
  originalQuantity: number
  returnQuantity: number
  unitPrice: number
  selected: boolean
}

export function ReturnsView({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<ReturnType>('sale')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { toast } = useToast()

  // تحميل المرتجعات
  const { data: saleReturns, loading: loadingSale } = useLiveData<SaleReturn[]>(
    () => saleReturnRepository.getByDateRange(),
    ['saleReturns']
  )
  const { data: purchaseReturns, loading: loadingPurchase } = useLiveData<PurchaseReturn[]>(
    () => purchaseReturnRepository.getByDateRange(),
    ['purchaseReturns']
  )

  const handleDeleteSale = async (id: string) => {
    if (!confirm('حذف هذا المرتجع؟ سيتم عكس كل التأثيرات على المخزون والخزينة.')) return
    try {
      await saleReturnRepository.delete(id)
      dataChangeEmitter.notifyDelete('saleReturns')
    } catch (e: any) {
      console.error(e)
      toast({ title: 'خطأ في حذف المرتجع', description: e.message, variant: 'destructive' })
    }
  }
  const handleDeletePurchase = async (id: string) => {
    if (!confirm('حذف هذا المرتجع؟ سيتم عكس كل التأثيرات على المخزون والخزينة.')) return
    try {
      await purchaseReturnRepository.delete(id)
      dataChangeEmitter.notifyDelete('purchaseReturns')
    } catch (e: any) {
      console.error(e)
      toast({ title: 'خطأ في حذف المرتجع', description: e.message, variant: 'destructive' })
    }
  }

  const saleList = saleReturns || []
  const purchaseList = purchaseReturns || []

  const filteredSale = search
    ? saleList.filter(
        (r) =>
          r.customerName.includes(search) ||
          (r.invoiceNo || '').includes(search) ||
          (r.returnNumber || '').includes(search)
      )
    : saleList
  const filteredPurchase = search
    ? purchaseList.filter(
        (r) =>
          r.supplierName.includes(search) ||
          (r.invoiceNo || '').includes(search) ||
          (r.returnNumber || '').includes(search)
      )
    : purchaseList

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-600">
              <X className="w-4 h-4 ml-1" />
              رجوع
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-800">المرتجعات</h2>
            <p className="text-xs text-slate-500">إدارة مرتجعات المبيعات والمشتريات</p>
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          <Plus className="w-4 h-4 ml-1" />
          مرتجع جديد
        </Button>
      </div>

      {/* البحث */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث برقم المرتجع أو الفاتورة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReturnType)}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="sale">
            <ShoppingCart className="w-3.5 h-3.5 ml-1" />
            مرتجع مبيعات ({saleList.length})
          </TabsTrigger>
          <TabsTrigger value="purchase">
            <Truck className="w-3.5 h-3.5 ml-1" />
            مرتجع مشتريات ({purchaseList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale">
          {loadingSale ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredSale.length === 0 ? (
            <EmptyState type="sale" />
          ) : (
            <div className="space-y-2">
              {filteredSale.map((r) => (
                <SaleReturnCard
                  key={r.id}
                  ret={r}
                  onDelete={() => handleDeleteSale(r.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchase">
          {loadingPurchase ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredPurchase.length === 0 ? (
            <EmptyState type="purchase" />
          ) : (
            <div className="space-y-2">
              {filteredPurchase.map((r) => (
                <PurchaseReturnCard
                  key={r.id}
                  ret={r}
                  onDelete={() => handleDeletePurchase(r.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {open && (
        <ReturnFormDialog
          open={open}
          onOpenChange={setOpen}
          type={tab}
          onSaved={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ===== حالة فارغة =====
function EmptyState({ type }: { type: ReturnType }) {
  return (
    <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
      <RotateCcw className="w-10 h-10 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-500">
        لا توجد مرتجعات {type === 'sale' ? 'مبيعات' : 'مشتريات'} مسجلة
      </p>
    </div>
  )
}

// ===== بطاقة مرتجع مبيعات =====
function SaleReturnCard({ ret, onDelete }: { ret: SaleReturn; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
              {ret.returnNumber}
            </Badge>
            {ret.invoiceNo && (
              <span className="text-[10px] text-slate-500">فاتورة: {ret.invoiceNo}</span>
            )}
          </div>
          <p className="font-bold text-slate-800 text-sm mt-1">{ret.customerName}</p>
          <p className="text-[10px] text-slate-500">{formatDate(ret.date)}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-rose-600"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      {ret.reason && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded p-1.5 mb-2">
          السبب: {ret.reason}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {ret.restockItems && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]">
              <CheckCircle2 className="w-3 h-3 ml-0.5" />
              أُعيد للمخزون
            </Badge>
          )}
          <span className="text-[10px] text-slate-500">
            {(ret.items || []).length} صنف
          </span>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-rose-700">{formatCurrency(ret.total)}</p>
          <p className="text-[10px] text-slate-500">مسترد للعميل</p>
        </div>
      </div>
    </div>
  )
}

// ===== بطاقة مرتجع مشتريات =====
function PurchaseReturnCard({ ret, onDelete }: { ret: PurchaseReturn; onDelete: () => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
              {ret.returnNumber}
            </Badge>
            {ret.invoiceNo && (
              <span className="text-[10px] text-slate-500">فاتورة: {ret.invoiceNo}</span>
            )}
          </div>
          <p className="font-bold text-slate-800 text-sm mt-1">{ret.supplierName}</p>
          <p className="text-[10px] text-slate-500">{formatDate(ret.date)}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-rose-600"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      {ret.reason && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded p-1.5 mb-2">
          السبب: {ret.reason}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">
          {(ret.items || []).length} صنف
        </span>
        <div className="text-left">
          <p className="text-sm font-bold text-emerald-700">{formatCurrency(ret.total)}</p>
          <p className="text-[10px] text-slate-500">مسترد من المورد</p>
        </div>
      </div>
    </div>
  )
}

// ===== نافذة إنشاء مرتجع =====
interface ReturnFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  type: ReturnType
  onSaved: () => void
}

function ReturnFormDialog({ open, onOpenChange, type, onSaved }: ReturnFormDialogProps) {
  const [invoiceId, setInvoiceId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [restockItems, setRestockItems] = useState(true)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // تحميل الفواتير
  const { data: sales } = useLiveData<Sale[]>(
    () => saleRepository.getByDateRange(),
    ['sales']
  )
  const { data: purchases } = useLiveData<Purchase[]>(
    () => purchaseRepository.getByDateRange(),
    ['purchases']
  )

  const salesList = sales || []
  const purchasesList = purchases || []

  // عند تغيير نوع المرتجع، إعادة التهيئة
  useEffect(() => {
    setInvoiceId('')
    setReturnItems([])
    setReason('')
    setNotes('')
    setRestockItems(true)
    setDate(todayStr())
  }, [type])

  const selectedSale = useMemo(
    () => salesList.find((s) => s.id === invoiceId),
    [salesList, invoiceId]
  )
  const selectedPurchase = useMemo(
    () => purchasesList.find((p) => p.id === invoiceId),
    [purchasesList, invoiceId]
  )

  // عند اختيار فاتورة، حمّل أصنافها
  useEffect(() => {
    if (invoiceId) {
      if (type === 'sale' && selectedSale) {
        setReturnItems(
          (selectedSale.items || []).map((it) => ({
            itemId: it.id,
            itemName: it.itemName,
            productId: it.productId,
            originalQuantity: it.quantity,
            returnQuantity: 0,
            unitPrice: it.unitPrice,
            selected: false,
          }))
        )
      } else if (type === 'purchase' && selectedPurchase) {
        setReturnItems(
          (selectedPurchase.items || []).map((it) => ({
            itemId: it.id,
            itemName: it.itemName,
            materialId: it.materialId,
            originalQuantity: it.quantity,
            returnQuantity: 0,
            unitPrice: it.unitPrice,
            selected: false,
          }))
        )
      }
    } else {
      setReturnItems([])
    }
  }, [invoiceId, type, selectedSale, selectedPurchase])

  const total = returnItems
    .filter((it) => it.selected)
    .reduce((s, it) => s + it.returnQuantity * it.unitPrice, 0)

  const updateItem = (i: number, field: keyof ReturnItem, value: any) => {
    const newItems = [...returnItems]
    ;(newItems[i] as any)[field] = value
    setReturnItems(newItems)
  }

  const toggleSelected = (i: number, checked: boolean) => {
    const newItems = [...returnItems]
    newItems[i].selected = checked
    newItems[i].returnQuantity = checked ? newItems[i].originalQuantity : 0
    setReturnItems(newItems)
  }

  const save = async () => {
    if (!invoiceId) {
      toast({
        title: 'تنبيه',
        description: 'اختر الفاتورة الأصلية',
        variant: 'destructive',
      })
      return
    }
    const selected = returnItems.filter((it) => it.selected && it.returnQuantity > 0)
    if (selected.length === 0) {
      toast({
        title: 'تنبيه',
        description: 'حدد صنفاً واحداً على الأقل للإرجاع',
        variant: 'destructive',
      })
      return
    }
    // التحقق من الكميات
    for (const it of selected) {
      if (it.returnQuantity > it.originalQuantity) {
        toast({
          title: 'تنبيه',
          description: `كمية الإرجاع (${it.returnQuantity}) أكبر من الكمية الأصلية (${it.originalQuantity}) في ${it.itemName}`,
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      if (type === 'sale') {
        await saleReturnRepository.createReturn({
          saleId: invoiceId,
          date,
          reason: reason || undefined,
          restockItems,
          notes: notes || undefined,
          items: selected.map((it) => ({
            saleItemId: it.itemId,
            itemName: it.itemName,
            productId: it.productId,
            quantity: Number(it.returnQuantity),
            unitPrice: Number(it.unitPrice),
          })),
        })
      } else {
        await purchaseReturnRepository.createReturn({
          purchaseId: invoiceId,
          date,
          reason: reason || undefined,
          notes: notes || undefined,
          items: selected.map((it) => ({
            purchaseItemId: it.itemId,
            itemName: it.itemName,
            materialId: it.materialId,
            quantity: Number(it.returnQuantity),
            unitPrice: Number(it.unitPrice),
          })),
        })
      }
      toast({
        title: 'تم',
        description: `تم إنشاء مرتجع ${type === 'sale' ? 'مبيعات' : 'مشتريات'} بقيمة ${formatCurrency(total)}`,
      })
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
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        dir="rtl"
        variant="bottom-sheet"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-600" />
            مرتجع {type === 'sale' ? 'مبيعات' : 'مشتريات'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            إنشاء مرتجع {type === 'sale' ? 'مبيعات' : 'مشتريات'} مع تحديث المخزون والخزينة
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-1 pb-2">
          {/* اختيار الفاتورة الأصلية */}
          <div>
            <Label className="text-xs">الفاتورة الأصلية *</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger className="bg-slate-50">
                <SelectValue
                  placeholder={
                    type === 'sale' ? 'اختر فاتورة مبيعات' : 'اختر فاتورة مشتريات'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {type === 'sale'
                  ? salesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.customerName} - {formatDate(s.date)}
                        {s.invoiceNo ? ` (${s.invoiceNo})` : ''}
                        {' - '}
                        {formatCurrency(s.total)}
                      </SelectItem>
                    ))
                  : purchasesList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.supplierName} - {formatDate(p.date)}
                        {p.invoiceNo ? ` (${p.invoiceNo})` : ''}
                        {' - '}
                        {formatCurrency(p.total)}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">تاريخ المرتجع</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-50"
            />
          </div>

          {/* الأصناف */}
          {returnItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-bold">الأصناف القابلة للإرجاع</Label>
              {returnItems.map((it, i) => (
                <div
                  key={it.itemId}
                  className="bg-slate-50 rounded-lg p-2 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={it.selected}
                      onCheckedChange={(v) => toggleSelected(i, v === true)}
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <div>
                        <p className="text-xs font-medium text-slate-800">{it.itemName}</p>
                        <p className="text-[10px] text-slate-500">
                          الكمية الأصلية: {it.originalQuantity} × {formatCurrency(it.unitPrice)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {it.selected && (
                    <div className="grid grid-cols-2 gap-2 pr-6">
                      <div>
                        <Label className="text-[10px]">كمية الإرجاع</Label>
                        <Input
                          type="number"
                          value={it.returnQuantity}
                          onChange={(e) =>
                            updateItem(i, 'returnQuantity', Number(e.target.value))
                          }
                          className="bg-white text-sm h-8"
                          min="0"
                          max={it.originalQuantity}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px]">الإجمالي</Label>
                        <div className="h-8 px-2 flex items-center bg-rose-50 rounded-md text-xs font-bold text-rose-700">
                          {formatCurrency(it.returnQuantity * it.unitPrice)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* خيار إرجاع للمخزون - فقط لمرتجع المبيعات */}
          {type === 'sale' && returnItems.length > 0 && (
            <div className="flex items-center gap-2 bg-emerald-50 rounded-lg p-2">
              <Checkbox
                checked={restockItems}
                onCheckedChange={(v) => setRestockItems(v === true)}
                id="restock"
              />
              <Label htmlFor="restock" className="text-xs cursor-pointer flex-1">
                إرجاع الأصناف إلى المخزون (يتم زيادة كمية المنتجات)
              </Label>
            </div>
          )}

          {/* السبب */}
          <div>
            <Label className="text-xs">سبب المرتجع</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: عيب في الصنف، خطأ في الطلب..."
              className="bg-slate-50"
            />
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

          {/* الإجمالي */}
          {total > 0 && (
            <div
              className={`rounded-lg p-3 text-white ${
                type === 'sale'
                  ? 'bg-gradient-to-l from-rose-500 to-red-600'
                  : 'bg-gradient-to-l from-emerald-500 to-teal-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">
                  {type === 'sale' ? 'المبلغ المسترد للعميل' : 'المبلغ المسترد من المورد'}
                </span>
                <span className="text-lg font-bold">{formatCurrency(total)}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 px-1 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ المرتجع'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
