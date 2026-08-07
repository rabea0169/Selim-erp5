'use client'

import {
  Pencil,
  Trash2,
  Tag,
  AlertTriangle,
  TrendingUp,
  Eye,
  PackagePlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import type { Product } from '@/lib/db'

interface ProductCardProps {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onView?: () => void
  onAdjustStock?: () => void
}

export function ProductCard({ product: p, onEdit, onDelete, onView, onAdjustStock }: ProductCardProps) {
  const isLowStock = p.reorderLevel && p.quantity <= p.reorderLevel
  const profitRetail = p.retailPrice - p.cost
  const profitRetailPct = p.cost > 0 ? (profitRetail / p.cost) * 100 : 0

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-3 transition-shadow ${
        onView ? 'cursor-pointer hover:shadow-md' : ''
      }`}
      onClick={onView}
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
          {onView && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-500 hover:text-indigo-600"
              onClick={(e) => {
                e.stopPropagation()
                onView()
              }}
              title="عرض التفاصيل"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {onAdjustStock && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-slate-500 hover:text-emerald-600"
              onClick={(e) => {
                e.stopPropagation()
                onAdjustStock()
              }}
              title="تعديل الرصيد"
            >
              <PackagePlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-500 hover:text-indigo-600"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-400 hover:text-rose-500"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
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
          <p className="text-sm font-bold text-rose-700">{formatCurrency(p.cost)}</p>
        </div>
      </div>

      {/* الأسعار الثلاث */}
      <div className="grid grid-cols-3 gap-1.5">
        <PriceCell label="جملة" price={p.wholesalePrice} cost={p.cost} />
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
}

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
        <p className="text-[9px] text-slate-400">+{profitPct.toFixed(0)}%</p>
      )}
    </div>
  )
}
