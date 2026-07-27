'use client'

import {
  ChevronLeft,
  Calendar,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import type { ProductionOrder } from '@/lib/db'
import { STATUS_LABELS, STATUS_STYLES } from './types'

interface OrderCardProps {
  order: ProductionOrder
  onClick: () => void
}

export function OrderCard({ order, onClick }: OrderCardProps) {
  const progress =
    order.quantity > 0
      ? Math.min(100, (order.completedQuantity / order.quantity) * 100)
      : 0
  const completedStages = order.stages.filter((s) => s.status === 'completed').length

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-3 hover:shadow-md transition-all text-right"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-slate-800">{order.orderNumber}</p>
            <Badge
              variant="outline"
              className={`text-[10px] ${STATUS_STYLES[order.status]}`}
            >
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-xs text-slate-600 font-medium">{order.productName}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
            <Calendar className="w-3 h-3" />
            {formatDate(order.date)}
            {order.expectedEndDate && (
              <span>• تسليم: {formatDate(order.expectedEndDate)}</span>
            )}
          </div>
        </div>
        <ChevronLeft className="w-4 h-4 text-slate-400" />
      </div>

      {/* شريط التقدم */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            الإنتاج: {order.completedQuantity} / {order.quantity} {order.unit}
          </span>
          <span>
            المراحل: {completedStages} / {order.stages.length}
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
}
