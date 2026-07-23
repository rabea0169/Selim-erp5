'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Factory,
  Play,
  Check,
  CheckCircle2,
  ChevronLeft,
  Calendar,
  Package,
  Layers,
  ListChecks,
  X,
  Trash2,
  AlertCircle,
  Circle,
  Clock,
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
  productionOrderRepository,
  productRepository,
  materialRepository,
  dataChangeEmitter,
  useLiveData,
  type ProductionOrder,
  type Product,
  type Material,
} from '@/lib/db'

const STATUS_LABELS: Record<ProductionOrder['status'], string> = {
  draft: 'مسودة',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
}

const STATUS_STYLES: Record<ProductionOrder['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}

const DEFAULT_STAGES = ['قص', 'خياطة', 'تشطيب', 'تعبئة']

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
  const { toast } = useToast()

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
      <ProductionOrderDetail
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
          {orders.map((o) => {
            const progress =
              o.quantity > 0
                ? Math.min(100, (o.completedQuantity / o.quantity) * 100)
                : 0
            const completedStages = o.stages.filter(
              (s) => s.status === 'completed'
            ).length
            const product = products.find((p) => p.id === o.productId)
            return (
              <button
                key={o.id}
                onClick={() => setDetailOrderId(o.id)}
                className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-3 hover:shadow-md transition-all text-right"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800">
                        {o.orderNumber}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${STATUS_STYLES[o.status]}`}
                      >
                        {STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      {o.productName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(o.date)}
                      {o.expectedEndDate && (
                        <span>• تسليم: {formatDate(o.expectedEndDate)}</span>
                      )}
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </div>

                {/* شريط التقدم */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      الإنتاج: {o.completedQuantity} / {o.quantity} {o.unit}
                    </span>
                    <span>
                      المراحل: {completedStages} / {o.stages.length}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-l from-emerald-500 to-teal-600 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <ProductionOrderForm
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

// ====== تفاصيل أمر التشغيل ======
interface DetailProps {
  order: ProductionOrder
  onBack: () => void
  onChanged: () => void
}

function ProductionOrderDetail({ order, onBack, onChanged }: DetailProps) {
  const { toast } = useToast()
  const [completeOpen, setCompleteOpen] = useState(false)

  const handleStartStage = async (stageId: string) => {
    try {
      await productionOrderRepository.startStage(order.id, stageId)
      dataChangeEmitter.notifyUpdate('productionOrders')
      onChanged()
      toast({ title: 'تم بدء المرحلة' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleCompleteStage = async (stageId: string) => {
    try {
      await productionOrderRepository.completeStage(order.id, stageId)
      dataChangeEmitter.notifyUpdate('productionOrders')
      onChanged()
      toast({ title: 'تم إكمال المرحلة' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleCancel = async () => {
    if (!confirm('إلغاء أمر التشغيل؟')) return
    try {
      await productionOrderRepository.update(order.id, {
        status: 'cancelled',
      })
      dataChangeEmitter.notifyUpdate('productionOrders')
      onChanged()
      toast({ title: 'تم إلغاء الأمر' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const handleCompleteOrder = async (completedQuantity: number) => {
    try {
      await productionOrderRepository.completeOrder(order.id, completedQuantity)
      dataChangeEmitter.notifyUpdate('productionOrders')
      dataChangeEmitter.notifyUpdate('products')
      onChanged()
      setCompleteOpen(false)
      toast({ title: 'تم إكمال أمر التشغيل' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  const progress =
    order.quantity > 0
      ? Math.min(100, (order.completedQuantity / order.quantity) * 100)
      : 0
  const isCompleted = order.status === 'completed'
  const isCancelled = order.status === 'cancelled'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
          رجوع للأوامر
        </button>
        <Badge
          variant="outline"
          className={`text-[10px] ${STATUS_STYLES[order.status]}`}
        >
          {STATUS_LABELS[order.status]}
        </Badge>
      </div>

      {/* رأس الأمر */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl p-4 shadow-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] text-slate-300">رقم الأمر</p>
            <p className="text-lg font-bold">{order.orderNumber}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
            <Factory className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/10 backdrop-blur rounded-lg p-2">
            <p className="text-slate-300">المنتج</p>
            <p className="font-bold text-white truncate">{order.productName}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2">
            <p className="text-slate-300">الكمية المطلوبة</p>
            <p className="font-bold text-white">
              {order.quantity} {order.unit}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2">
            <p className="text-slate-300">المنجز</p>
            <p className="font-bold text-emerald-300">
              {order.completedQuantity} {order.unit}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-2">
            <p className="text-slate-300">التاريخ</p>
            <p className="font-bold text-white">{formatDate(order.date)}</p>
          </div>
        </div>
        {order.expectedEndDate && (
          <div className="mt-2 bg-white/10 backdrop-blur rounded-lg p-2 text-xs flex items-center justify-between">
            <span className="text-slate-300">تاريخ التسليم المتوقع</span>
            <span className="font-bold text-amber-300">
              {formatDate(order.expectedEndDate)}
            </span>
          </div>
        )}
      </div>

      {/* شريط التقدم */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
          <span className="font-bold">نسبة الإنجاز</span>
          <span className="font-bold text-emerald-700">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-emerald-500 to-teal-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* المواد المستخدمة */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
          <Package className="w-3.5 h-3.5" />
          المواد الخام المستخدمة
        </p>
        {order.materials.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2">
            لا توجد مواد مسجلة
          </p>
        ) : (
          <div className="space-y-1.5">
            {order.materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-xs bg-slate-50 rounded-lg p-2"
              >
                <span className="text-slate-700 font-medium">{m.materialName}</span>
                <span className="font-bold text-slate-800">
                  {m.quantity} {m.unit}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* مراحل التصنيع */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5" />
          مراحل التصنيع
        </p>
        {order.stages.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2">
            لا توجد مراحل مسجلة
          </p>
        ) : (
          <div className="space-y-2">
            {order.stages.map((s, idx) => {
              const stageStyle =
                s.status === 'completed'
                  ? {
                      bg: 'bg-emerald-50',
                      text: 'text-emerald-700',
                      border: 'border-emerald-200',
                      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    }
                  : s.status === 'in_progress'
                  ? {
                      bg: 'bg-blue-50',
                      text: 'text-blue-700',
                      border: 'border-blue-200',
                      icon: <Clock className="w-4 h-4 text-blue-600" />,
                    }
                  : {
                      bg: 'bg-slate-50',
                      text: 'text-slate-600',
                      border: 'border-slate-200',
                      icon: <Circle className="w-4 h-4 text-slate-400" />,
                    }
              return (
                <div
                  key={s.id}
                  className={`rounded-lg p-2 border ${stageStyle.bg} ${stageStyle.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[10px] font-bold text-slate-400">
                        {idx + 1}
                      </span>
                      {stageStyle.icon}
                      <div className="flex-1">
                        <p className={`text-xs font-bold ${stageStyle.text}`}>
                          {s.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          {s.startedAt && (
                            <span>بدء: {formatDate(s.startedAt)}</span>
                          )}
                          {s.completedAt && (
                            <span>إكمال: {formatDate(s.completedAt)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {!isCompleted && !isCancelled && (
                      <div className="flex gap-1">
                        {s.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartStage(s.id)}
                            className="h-7 text-[10px] font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            <Play className="w-3 h-3 ml-1" />
                            بدء
                          </Button>
                        )}
                        {s.status === 'in_progress' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompleteStage(s.id)}
                            className="h-7 text-[10px] font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <Check className="w-3 h-3 ml-1" />
                            إكمال
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ملاحظات */}
      {order.notes && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
          <p className="text-xs font-bold text-slate-700 mb-1">ملاحظات</p>
          <p className="text-[11px] text-slate-600 whitespace-pre-wrap">
            {order.notes}
          </p>
        </div>
      )}

      {/* أزرار الإجراءات */}
      {!isCompleted && !isCancelled && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="h-9 text-xs font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
          >
            <X className="w-4 h-4 ml-1" />
            إلغاء الأمر
          </Button>
          <Button
            onClick={() => setCompleteOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 ml-1" />
            إكمال الأمر
          </Button>
        </div>
      )}

      {completeOpen && (
        <CompleteOrderDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          order={order}
          onConfirm={handleCompleteOrder}
        />
      )}
    </div>
  )
}

// ====== نموذج إكمال الأمر ======
function CompleteOrderDialog({
  open,
  onOpenChange,
  order,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  order: ProductionOrder
  onConfirm: (qty: number) => void
}) {
  const [qty, setQty] = useState(String(order.quantity))
  const { toast } = useToast()

  const confirm = () => {
    const num = Number(qty)
    if (!num || num <= 0) {
      toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' })
      return
    }
    onConfirm(num)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">إكمال أمر التشغيل</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-emerald-50 rounded-lg p-3 text-xs">
            <p className="text-emerald-800">
              <AlertCircle className="w-3.5 h-3.5 inline ml-1" />
              سيتم إضافة الكمية المنتهية لمخزون المنتج
            </p>
          </div>
          <div>
            <Label className="text-xs">الكمية المنتهية *</Label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="bg-slate-50 font-bold text-emerald-700"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              المطلوب: {order.quantity} {order.unit}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs font-medium"
          >
            إلغاء
          </Button>
          <Button
            onClick={confirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 ml-1" />
            تأكيد الإكمال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ====== نموذج إنشاء أمر تشغيل ======
interface FormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  products: Product[]
  materials: Material[]
  onSaved: () => void
}

interface MaterialSelection {
  materialId: string
  quantity: number
}

function ProductionOrderForm({
  open,
  onOpenChange,
  products,
  materials,
  onSaved,
}: FormProps) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialSelection[]>([])
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES)
  const [expectedEndDate, setExpectedEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // reset عند الإغلاق
  useEffect(() => {
    if (!open) {
      // تأخير بسيط لتجنب flicker
      Promise.resolve().then(() => {
        setProductId('')
        setQuantity('1')
        setSelectedMaterials([])
        setStages(DEFAULT_STAGES)
        setExpectedEndDate('')
        setNotes('')
      })
    }
  }, [open])

  const selectedProduct = products.find((p) => p.id === productId)

  // المواد الخام المتاحة (في مخازن المواد الخام)
  const availableMaterials = materials

  const addMaterial = () => {
    setSelectedMaterials([
      ...selectedMaterials,
      { materialId: '', quantity: 1 },
    ])
  }

  const updateMaterial = (idx: number, field: 'materialId' | 'quantity', value: any) => {
    const updated = [...selectedMaterials]
    updated[idx] = { ...updated[idx], [field]: value }
    setSelectedMaterials(updated)
  }

  const removeMaterial = (idx: number) => {
    setSelectedMaterials(selectedMaterials.filter((_, i) => i !== idx))
  }

  const addStage = () => {
    setStages([...stages, ''])
  }

  const updateStage = (idx: number, value: string) => {
    const updated = [...stages]
    updated[idx] = value
    setStages(updated)
  }

  const removeStage = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx))
  }

  const save = async () => {
    if (!productId) {
      toast({ title: 'اختر المنتج', variant: 'destructive' })
      return
    }
    if (!selectedProduct) {
      toast({ title: 'المنتج غير موجود', variant: 'destructive' })
      return
    }
    const qty = Number(quantity)
    if (!qty || qty <= 0) {
      toast({ title: 'أدخل كمية صحيحة', variant: 'destructive' })
      return
    }

    // تحقق من المواد
    const validMaterials = selectedMaterials.filter((m) => m.materialId)
    for (const sm of validMaterials) {
      const mat = materials.find((m) => m.id === sm.materialId)
      if (!mat) {
        toast({ title: 'مادة غير موجودة', variant: 'destructive' })
        return
      }
      if (mat.quantity < sm.quantity * qty) {
        toast({
          title: `المادة ${mat.name} غير متاحة`,
          description: `متاح: ${mat.quantity} ${mat.unit} • مطلوب: ${sm.quantity * qty}`,
          variant: 'destructive',
        })
        return
      }
    }

    const validStages = stages.filter((s) => s.trim())

    setSaving(true)
    try {
      await productionOrderRepository.createOrder({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: qty,
        unit: selectedProduct.unit,
        materials: validMaterials.map((sm) => {
          const mat = materials.find((m) => m.id === sm.materialId)!
          return {
            materialId: sm.materialId,
            materialName: mat.name,
            quantity: sm.quantity * qty,
            unit: mat.unit,
          }
        }),
        stages: validStages.map((name) => ({ name: name.trim() })),
        expectedEndDate: expectedEndDate || undefined,
        notes: notes.trim() || undefined,
      })
      dataChangeEmitter.notifyCreate('productionOrders')
      dataChangeEmitter.notifyUpdate('materials')
      dataChangeEmitter.notifyCreate('materialTransactions')
      toast({
        title: 'تم إنشاء أمر التشغيل',
        description: 'تم سحب المواد الخام من المخزن',
      })
      onSaved()
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">أمر تشغيل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* المنتج */}
          <div>
            <Label className="text-xs">المنتج *</Label>
            <Select
              value={productId || '__none__'}
              onValueChange={(v) => setProductId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="bg-slate-50">
                <SelectValue placeholder="اختر المنتج" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— اختر —</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (متاح: {p.quantity} {p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الكمية */}
          <div>
            <Label className="text-xs">الكمية المطلوبة *</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
              className="bg-slate-50 font-bold"
            />
            {selectedProduct && (
              <p className="text-[10px] text-slate-500 mt-1">
                التكلفة المتوقعة: {formatCurrency(selectedProduct.cost * (Number(quantity) || 0))}
              </p>
            )}
          </div>

          {/* المواد الخام */}
          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">المواد الخام</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMaterial}
                className="h-7 text-[11px] border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة مادة
              </Button>
            </div>
            {selectedMaterials.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-2">
                لا توجد مواد مضافة (يمكن الإضافة لاحقاً)
              </p>
            ) : (
              <div className="space-y-2">
                {selectedMaterials.map((sm, idx) => {
                  const mat = materials.find((m) => m.id === sm.materialId)
                  return (
                    <div
                      key={idx}
                      className="bg-white rounded-lg p-2 space-y-1.5 border border-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={sm.materialId || '__none__'}
                          onValueChange={(v) =>
                            updateMaterial(idx, 'materialId', v === '__none__' ? '' : v)
                          }
                        >
                          <SelectTrigger className="bg-slate-50 text-xs h-8 flex-1">
                            <SelectValue placeholder="اختر المادة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— اختر —</SelectItem>
                            {availableMaterials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} (متاح: {m.quantity} {m.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMaterial(idx)}
                          className="h-7 w-7 text-rose-500 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <Label className="text-[10px]">الكمية لكل وحدة</Label>
                          <Input
                            type="number"
                            value={sm.quantity}
                            onChange={(e) =>
                              updateMaterial(idx, 'quantity', Number(e.target.value))
                            }
                            className="bg-slate-50 text-xs h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">الإجمالي</Label>
                          <div className="h-8 px-2 flex items-center bg-amber-50 rounded-md text-[11px] font-bold text-amber-700">
                            {sm.quantity * (Number(quantity) || 0)} {mat?.unit || ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* مراحل التصنيع */}
          <div className="bg-slate-50 rounded-lg p-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Layers className="w-3 h-3" />
                مراحل التصنيع
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStage}
                className="h-7 text-[11px] border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <Plus className="w-3 h-3 ml-1" />
                إضافة مرحلة
              </Button>
            </div>
            <div className="space-y-1.5">
              {stages.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-4">
                    {idx + 1}
                  </span>
                  <Input
                    value={s}
                    onChange={(e) => updateStage(idx, e.target.value)}
                    placeholder="اسم المرحلة"
                    className="bg-white text-xs h-8"
                  />
                  {stages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeStage(idx)}
                      className="h-7 w-7 text-rose-500 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* تاريخ التسليم */}
          <div>
            <Label className="text-xs">تاريخ التسليم المتوقع</Label>
            <Input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className="bg-slate-50"
            />
          </div>

          {/* ملاحظات */}
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs font-medium"
          >
            {saving ? 'جارٍ الحفظ...' : 'إنشاء الأمر'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
