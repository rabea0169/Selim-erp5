'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  Factory,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format'
import {
  productionOrderRepository,
  dataChangeEmitter,
  type ProductionOrder,
} from '@/lib/db'
import { STATUS_LABELS, STATUS_STYLES } from './types'
import { StagesList } from './StagesList'

interface OrderDetailsProps {
  order: ProductionOrder
  onBack: () => void
  onChanged: () => void
}

export function OrderDetails({ order, onBack, onChanged }: OrderDetailsProps) {
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
      <StagesList
        order={order}
        isCompleted={isCompleted}
        isCancelled={isCancelled}
        onStartStage={handleStartStage}
        onCompleteStage={handleCompleteStage}
      />

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
          <DialogDescription className="sr-only">إدارة أوامر التشغيل</DialogDescription>
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
