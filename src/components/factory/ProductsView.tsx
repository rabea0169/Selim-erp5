'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Boxes,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/format'
import {
  productRepository,
  dataChangeEmitter,
  useLiveData,
  type Product,
} from '@/lib/db'
import { ProductCard } from './products/ProductCard'
import { ProductForm } from './products/ProductForm'

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

  const totalValue = productsList.reduce((s, p) => s + p.quantity * p.cost, 0)
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
          {productsList.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => {
                setEditProduct(p)
                setOpen(true)
              }}
              onDelete={() => handleDelete(p.id)}
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
    </div>
  )
}
