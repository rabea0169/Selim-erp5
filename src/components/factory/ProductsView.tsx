'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Boxes,
  BarChart3,
  TrendingUp,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatNumber } from '@/lib/format'
import {
  productRepository,
  dataChangeEmitter,
  useLiveData,
  type Product,
} from '@/lib/db'
import { ProductCard } from './products/ProductCard'
import { ProductForm } from './products/ProductForm'
import { ProductDetail } from './products/ProductDetail'

async function fetchProducts(search: string): Promise<Product[]> {
  return productRepository.search(search)
}

export function ProductsView() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const { toast } = useToast()

  const { data: products, loading, reload } = useLiveData<Product[]>(
    () => fetchProducts(search),
    ['products']
  )

  useEffect(() => {
    reload()
  }, [search, reload])

  const productsList: Product[] = products || []

  // استخراج التصنيفات الفريدة
  const categories = useMemo(() => {
    const cats = new Set<string>()
    productsList.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [productsList])

  // تطبيق الفلاتر
  const filteredProducts = useMemo(() => {
    let list = productsList
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter)
    }
    if (stockFilter === 'low') {
      list = list.filter((p) => p.reorderLevel && p.quantity <= p.reorderLevel)
    } else if (stockFilter === 'out') {
      list = list.filter((p) => p.quantity === 0)
    } else if (stockFilter === 'available') {
      list = list.filter((p) => p.quantity > 0)
    }
    return list
  }, [productsList, categoryFilter, stockFilter])

  const lowStock = productsList.filter(
    (p) => p.reorderLevel && p.quantity <= p.reorderLevel
  )
  const outOfStock = productsList.filter((p) => p.quantity === 0)

  const totalValue = productsList.reduce((s, p) => s + p.quantity * p.cost, 0)
  const totalRetailValue = productsList.reduce((s, p) => s + p.quantity * p.retailPrice, 0)
  const totalUnits = productsList.reduce((s, p) => s + p.quantity, 0)
  const productsWithCost = productsList.filter((p) => p.cost > 0)
  const avgProfitMargin = productsWithCost.length > 0
    ? productsWithCost.reduce((s, p) => {
        return s + ((p.retailPrice - p.cost) / p.cost) * 100
      }, 0) / productsWithCost.length
    : 0

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

  const hasFilters = categoryFilter !== 'all' || stockFilter !== 'all'

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
            <p className="text-xs text-indigo-100">إجمالي قيمة المخزون (التكلفة)</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-[10px] text-indigo-100 mt-1">
              {productsList.length} منتج · {totalUnits} وحدة · قيمة البيع: {formatCurrency(totalRetailValue)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center mx-auto mb-1">
            <Package className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-[9px] text-slate-500">المنتجات</p>
          <p className="text-sm font-bold text-slate-800">{productsList.length}</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mx-auto mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-[9px] text-slate-500">متوسط الربح</p>
          <p className="text-sm font-bold text-emerald-700">{avgProfitMargin.toFixed(0)}%</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mx-auto mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-[9px] text-slate-500">منخفض المخزون</p>
          <p className="text-sm font-bold text-amber-700">{lowStock.length}</p>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-slate-100 text-center">
          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center mx-auto mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <p className="text-[9px] text-slate-500">نفذت الكمية</p>
          <p className="text-sm font-bold text-rose-700">{outOfStock.length}</p>
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

      {/* بحث + فلاتر */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المنتج أو الفئة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <div className="flex gap-2">
          {categories.length > 0 && (
            <div className="flex-1">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs">
                  <Filter className="w-3 h-3 ml-1 text-slate-400" />
                  <SelectValue placeholder="التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل التصنيفات</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200 h-8 text-xs">
                <Package className="w-3 h-3 ml-1 text-slate-400" />
                <SelectValue placeholder="المخزون" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المنتجات</SelectItem>
                <SelectItem value="available">متوفر فقط</SelectItem>
                <SelectItem value="low">منخفض المخزون</SelectItem>
                <SelectItem value="out">نفذت الكمية</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500">
              عرض {filteredProducts.length} من {productsList.length} منتج
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCategoryFilter('all'); setStockFilter('all') }}
              className="text-[10px] text-slate-500 h-6"
            >
              مسح الفلترة
            </Button>
          </div>
        )}
      </div>

      {/* قائمة المنتجات */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {hasFilters ? 'لا توجد منتجات تطابق الفلتر' : 'لا توجد منتجات مسجلة'}
          </p>
          {!hasFilters && <p className="text-xs text-slate-400 mt-1">أضف منتجك الأول</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => {
                setEditProduct(p)
                setOpen(true)
              }}
              onDelete={() => handleDelete(p.id)}
              onView={() => setSelectedProduct(p)}
            />
          ))}
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

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          open={true}
          onOpenChange={(o) => {
            if (!o) setSelectedProduct(null)
          }}
        />
      )}
    </div>
  )
}
