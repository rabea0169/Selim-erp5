'use client'

import {
  Package,
  PackageOpen,
  Boxes,
  ChevronLeft,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import type { Warehouse, Material } from '@/lib/db'
import { WAREHOUSE_TYPE_LABELS, WAREHOUSE_TYPE_STYLES } from './types'

interface WarehouseCardProps {
  warehouse: Warehouse
  materials: Material[]
  onClick: () => void
  onDelete?: (id: string) => void
}

export function WarehouseCard({ warehouse, materials, onClick, onDelete }: WarehouseCardProps) {
  const wMaterials = materials.filter((m) => m.warehouseId === warehouse.id)
  const wValue = wMaterials.reduce((s, m) => s + m.quantity * m.unitCost, 0)
  const style = WAREHOUSE_TYPE_STYLES[warehouse.type]

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-all text-right cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-9 h-9 rounded-xl ${style.iconBg} flex items-center justify-center`}
            >
              {warehouse.type === 'raw_materials' ? (
                <Package className={`w-5 h-5 ${style.iconText}`} />
              ) : warehouse.type === 'finished_goods' ? (
                <PackageOpen className={`w-5 h-5 ${style.iconText}`} />
              ) : (
                <Boxes className={`w-5 h-5 ${style.iconText}`} />
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{warehouse.name}</p>
              <Badge
                variant="outline"
                className={`text-[10px] ${style.badgeBg} ${style.badgeText} ${style.badgeBorder}`}
              >
                {WAREHOUSE_TYPE_LABELS[warehouse.type]}
              </Badge>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <p className="text-slate-400">عدد المواد</p>
              <p className="font-bold text-slate-700">{wMaterials.length}</p>
            </div>
            <div>
              <p className="text-slate-400">قيمة المخزون</p>
              <p className="font-bold text-emerald-700">{formatCurrency(wValue)}</p>
            </div>
            <div>
              <p className="text-slate-400">الموقع</p>
              <p className="font-bold text-slate-700 truncate">
                {warehouse.location || '—'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(warehouse.id)
              }}
              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
              aria-label="حذف المخزن"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  )
}
