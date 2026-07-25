'use client'

import { usePermissions } from '@/hooks/usePermissions'
  const currentUser = getCurrentUser()
  const perms = usePermissions(currentUser?.role)
import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Plus,
  Factory,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { usePermissions } from '@/hooks/usePermissions'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/hooks/usePermissions'
import { Label } from '@/components/ui/label'
import { usePermissions } from '@/hooks/usePermissions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePermissions } from '@/hooks/usePermissions'
import {
  productionOrderRepository,
  productRepository,
  materialRepository,
  useLiveData,
  type ProductionOrder,
  type Product,
  type Material,
} { getCurrentUser } from '@/lib/db'
import { usePermissions } from '@/hooks/usePermissions'
import { OrderCard } from './production-orders/OrderCard'
import { usePermissions } from '@/hooks/usePermissions'
import { OrderForm } from './production-orders/OrderForm'
import { usePermissions } from '@/hooks/usePermissions'
import { OrderDetails } from './production-orders/OrderDetails'

interface OrdersData {
  orders: ProductionOrder[]
  products: Product[]
  materials: Material[]
}

async function fetchOrdersData(statusFilter: string): Promise<OrdersData> {
  const [orders, products, materials] = await Promise.all([
    statusFilter === 'all'
      ? productionOrderRepository.getAll()
      : productionOrderRepository.getByStatus(statusFilter as ProductionOrder['status']),
    productRepository.getAll(),
    materialRepository.getAll(),
  ])
  return {
    orders: orders.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    products,
    materials,
  }
}

export function ProductionOrdersView() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  const { data, loading, reload } = useLiveData<OrdersData>(
    () => fetchOrdersData(statusFilter),
    ['productionOrders', 'products', 'materials']
  )

  // إعادة التحميل عند تغير الفلتر
  useEffect(() => {
    reload()
  }, [statusFilter, reload])

  const orders: ProductionOrder[] = data?.orders || []
  const products: Product[] = data?.products || []
  const materials: Material[] = data?.materials || []

  const detailOrder = detailOrderId
    ? orders.find((o) => o.id === detailOrderId)
    : null

  if (detailOrder) {
    return (
      <OrderDetails
        order={detailOrder}
        onBack={() => setDetailOrderId(null)}
        onChanged={reload}
      />
    )
  }

  const inProgressCount = orders.filter((o) => o.status === 'in_progress').length
  const completedCount = orders.filter((o) => o.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">أوامر التشغيل</h2>
          <p className="text-xs text-slate-500">إدارة أوامر التصنيع ومراحلها</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 text-xs font-medium"
        >
          <Plus className="w-4 h-4 ml-1" />
          أمر تشغيل
        </Button>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-500">الإجمالي</p>
            <Factory className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-800">{orders.length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-blue-600">قيد التنفيذ</p>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-sm font-bold text-blue-700">{inProgressCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-emerald-600">مكتملة</p>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-emerald-700">{completedCount}</p>
        </div>
      </div>

      {/* فلترة بالحالة */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <Label className="text-[10px] text-slate-500 mb-1 block">فلترة بالحالة</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-slate-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مسودة</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="completed">مكتملة</SelectItem>
            <SelectItem value="cancelled">ملغية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* قائمة الأوامر */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Factory className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد أوامر تشغيل</p>
          <p className="text-xs text-slate-400 mt-1">ابدأ بإنشاء أول أمر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onClick={() => setDetailOrderId(o.id)}
            />
          ))}
        </div>
      )}

      <OrderForm
        open={open}
        onOpenChange={setOpen}
        products={products}
        materials={materials}
        onSaved={() => {
          setOpen(false)
          reload()
        }}
      />
    </div>
  )
}
