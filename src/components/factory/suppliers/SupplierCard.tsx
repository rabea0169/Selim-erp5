'use client'

import {
  Trash2,
  Phone,
  MapPin,
  Pencil,
  FileText,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'

export interface SupplierWithStats {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  createdAt?: string
  totalPurchases: number
  totalPaid: number
  totalRemaining: number
  purchasesCount: number
}

interface SupplierCardProps {
  supplier: SupplierWithStats
  onEdit: () => void
  onDelete: () => void
  onShowReport: () => void
}

export function SupplierCard({
  supplier: s,
  onEdit,
  onDelete,
  onShowReport,
}: SupplierCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-800">{s.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {s.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {s.phone}
                </span>
              )}
              {s.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {s.address}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-blue-600"
            onClick={onShowReport}
            title="تقرير المورد"
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-slate-600"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-rose-600"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-amber-700">إجمالي المشتريات</p>
          <p className="font-bold text-amber-900">{formatCurrency(s.totalPurchases)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-blue-700">المدفوع</p>
          <p className="font-bold text-blue-900">{formatCurrency(s.totalPaid)}</p>
        </div>
        <div className="bg-rose-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-rose-700">المتبقي له</p>
          <p className="font-bold text-rose-900">{formatCurrency(s.totalRemaining)}</p>
        </div>
      </div>
    </div>
  )
}
