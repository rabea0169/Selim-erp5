'use client'

import { useState } from 'react'
import {
  Plus,
  Search,
  Package,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/format'
import type { Warehouse, Material } from '@/lib/db'
import { WAREHOUSE_TYPE_LABELS, WAREHOUSE_TYPE_STYLES } from './types'
import { StockDialog } from './StockDialog'

interface MaterialListProps {
  warehouse: Warehouse
  materials: Material[]
  onBack: () => void
  onAddMaterial: () => void
  onDeleteMaterial: (id: string) => void
}

export function MaterialList({
  warehouse,
  materials,
  onBack,
  onAddMaterial,
  onDeleteMaterial,
}: MaterialListProps) {
  const [search, setSearch] = useState('')
  const [addStockFor, setAddStockFor] = useState<Material | null>(null)
  const [consumeStockFor, setConsumeStockFor] = useState<Material | null>(null)

  const filtered = materials.filter(
    (m) =>
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase())
  )
  const totalValue = materials.reduce((s, m) => s + m.quantity * m.unitCost, 0)
  const style = WAREHOUSE_TYPE_STYLES[warehouse.type]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
          رجوع للمخازن
        </button>
        <Button
          onClick={onAddMaterial}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm h-9 text-xs font-medium"
        >
          <Plus className="w-4 h-4 ml-1" />
          مادة جديدة
        </Button>
      </div>

      {/* رأس تفاصيل المخزن */}
      <div className={`bg-gradient-to-br ${style.headerGradient} text-white rounded-2xl p-4 shadow-md`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/80">{WAREHOUSE_TYPE_LABELS[warehouse.type]}</p>
            <p className="text-xl font-bold">{warehouse.name}</p>
            {warehouse.location && (
              <p className="text-[10px] text-white/80 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {warehouse.location}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/80">قيمة المخزون</p>
            <p className="text-lg font-bold">{formatCurrency(totalValue)}</p>
            <p className="text-[10px] text-white/80">{materials.length} مادة</p>
          </div>
        </div>
      </div>

      {/* بحث */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المادة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
      </div>

      {/* قائمة المواد */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {search ? 'لا نتائج للبحث' : 'لا توجد مواد في هذا المخزن'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const value = m.quantity * m.unitCost
            const isLowStock = m.reorderLevel && m.quantity <= m.reorderLevel
            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800">{m.name}</p>
                      {isLowStock && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                          منخفض
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      التكلفة: {formatCurrency(m.unitCost)} / {m.unit}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-slate-400 hover:text-rose-500"
                    onClick={() => onDeleteMaterial(m.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500">الكمية المتاحة</p>
                    <p className="text-sm font-bold text-slate-800">
                      {m.quantity} <span className="text-xs text-slate-500">{m.unit}</span>
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-[10px] text-emerald-600">القيمة الإجمالية</p>
                    <p className="text-sm font-bold text-emerald-700">
                      {formatCurrency(value)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddStockFor(m)}
                    className="h-8 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 ml-1" />
                    إضافة كمية
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConsumeStockFor(m)}
                    className="h-8 text-xs font-medium border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={m.quantity <= 0}
                  >
                    <ArrowUpFromLine className="w-3.5 h-3.5 ml-1" />
                    سحب كمية
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* نوافذ إضافة/سحب كمية */}
      {addStockFor && (
        <StockDialog
          open={true}
          onOpenChange={(v) => !v && setAddStockFor(null)}
          material={addStockFor}
          mode="add"
          onSaved={() => setAddStockFor(null)}
        />
      )}
      {consumeStockFor && (
        <StockDialog
          open={true}
          onOpenChange={(v) => !v && setConsumeStockFor(null)}
          material={consumeStockFor}
          mode="consume"
          onSaved={() => setConsumeStockFor(null)}
        />
      )}
    </div>
  )
}
