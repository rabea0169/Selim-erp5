'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Tag,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
  Boxes,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  productRepository,
  dataChangeEmitter,
  useLiveData,
  type Product,
} from '@/lib/db'

const UNITS = ['قطعة', 'زوج', 'متر', 'كجم', 'علبة', 'كرتونة', 'عبوة']

async function fetchProducts(search: string): Promise<Product[]> {
  return productRepository.search(search)
}

export function ProductsView() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const { toast } = useToast()

  const { data: products, loading, reload } = useLiveData<Product[]>(
    () => fetchProducts(search),
    ['products']
  )

  // إعادة التحميل عند البحث
  useEffect(() => {
    reload()
  }, [search, reload])

  const productsList: Product[] = products || []
  const lowStock = productsList.filter(
    (p) => p.reorderLevel && p.quantity <= p.reorderLevel
  )

  const totalValue = productsList.reduce(
    (s, p) => s + p.quantity * p.cost,
    0
  )
  const totalUnits = productsList.reduce((s, p) => s + p.quantity, 0)

  const handleDelete = async (id: string) => {
    if (!confirm('حذف هذا المنتج؟')) return
    try {
      await productRepository.delete(id)
      dataChangeEmitter.notifyDelete('products')
      toast({ title: 'تم الحذف' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">المنتجات</h2>
          <p className="text-xs text-slate-500">إدارة المنتجات وأسعارها ومخزونها</p>
        </div>
        <Button
          onClick={() => {
            setEditProduct(null)
            setOpen(true)
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 text-xs font-medium"
        >
          <Plus className="w-4 h-4 ml-1" />
          منتج جديد
        </Button>
      </div>

      {/* بطاقة إجمالي قيمة المخزون */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl p-4 shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-100">إجمالي قيمة المنتجات</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-[10px] text-indigo-100 mt-1">
              {productsList.length} منتج • {totalUnits} وحدة
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* تنبيه المخزون المنخفض */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-bold text-amber-800">
                {lowStock.length} منتج بمخزون منخفض
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {lowStock.slice(0, 5).map((p) => (
                  <Badge
                    key={p.id}
                    variant="outline"
                    className="text-[10px] bg-white text-amber-700 border-amber-200"
                  >
                    {p.name} ({p.quantity})
                  </Badge>
                ))}
                {lowStock.length > 5 && (
                  <span className="text-[10px] text-amber-600">
                    +{lowStock.length - 5}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* بحث */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المنتج أو الفئة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* قائمة المنتجات */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : productsList.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد منتجات مسجلة</p>
          <p className="text-xs text-slate-400 mt-1">أضف منتجك الأول</p>
        </div>
      ) : (
        <div className="space-y-2">
          {productsList.map((p) => {
            const isLowStock = p.reorderLevel && p.quantity <= p.reorderLevel
            const profitRetail = p.retailPrice - p.cost
            const profitRetailPct =
              p.cost > 0 ? (profitRetail / p.cost) * 100 : 0
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800">{p.name}</p>
                      {isLowStock && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          منخفض
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      {p.category && (
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {p.category}
                        </Badge>
                      )}
                      <span>الوحدة: {p.unit}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                      onClick={() => {
                        setEditProduct(p)
                        setOpen(true)
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-rose-500"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* الكمية + التكلفة */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">الكمية المتاحة</p>
                    <p className="text-sm font-bold text-slate-800">
                      {p.quantity} <span className="text-xs text-slate-500">{p.unit}</span>
                    </p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2">
                    <p className="text-[10px] text-rose-600">التكلفة</p>
                    <p className="text-sm font-bold text-rose-700">
                      {formatCurrency(p.cost)}
                    </p>
                  </div>
                </div>

                {/* الأسعار الثلاث */}
                <div className="grid grid-cols-3 gap-1.5">
                  <PriceCell
                    label="جملة"
                    price={p.wholesalePrice}
                    cost={p.cost}
                  />
                  <PriceCell
                    label="نصف جملة"
                    price={p.halfWholesalePrice}
                    cost={p.cost}
                  />
                  <PriceCell
                    label="قطاعي"
                    price={p.retailPrice}
                    cost={p.cost}
                    highlight
                  />
                </div>

                {/* ربح القطاعي */}
                {p.cost > 0 && (
                  <div className="mt-2 flex items-center justify-between bg-emerald-50 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      ربح القطاعي
                    </p>
                    <p className="text-xs font-bold text-emerald-700">
                      {formatCurrency(profitRetail)} ({profitRetailPct.toFixed(0)}%)
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ProductForm
        open={open}
        onOpenChange={setOpen}
        editProduct={editProduct}
        onSaved={() => {
          setOpen(false)
          setEditProduct(null)
          reload()
        }}
      />
    </div>
  )
}

// ====== خلية سعر ======
function PriceCell({
  label,
  price,
  cost,
  highlight,
}: {
  label: string
  price: number
  cost: number
  highlight?: boolean
}) {
  const profit = price - cost
  const profitPct = cost > 0 ? (profit / cost) * 100 : 0
  return (
    <div
      className={`rounded-lg p-2 text-center ${
        highlight
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-slate-50 border border-slate-100'
      }`}
    >
      <p className={`text-[9px] ${highlight ? 'text-emerald-700' : 'text-slate-500'}`}>
        {label}
      </p>
      <p className={`text-xs font-bold ${highlight ? 'text-emerald-700' : 'text-slate-700'}`}>
        {formatCurrency(price)}
      </p>
      {cost > 0 && (
        <p className="text-[9px] text-slate-400">
          +{profitPct.toFixed(0)}%
        </p>
      )}
    </div>
  )
}

// ====== نموذج إضافة/تعديل منتج ======
interface ProductFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editProduct: Product | null
  onSaved: () => void
}

function ProductForm({ open, onOpenChange, editProduct, onSaved }: ProductFormProps) {
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
    setWholesalePrice(String((c * 1.15).toFixed(2)))
    setHalfWholesalePrice(String((c * 1.25).toFixed(2)))
    setRetailPrice(String((c * 1.4).toFixed(2)))
    toast({ title: 'تم اقتراح الأسعار (15%, 25%, 40%)' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {editProduct ? 'تعديل المنتج' : 'منتج جديد'}
          </DialogTitle>
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
