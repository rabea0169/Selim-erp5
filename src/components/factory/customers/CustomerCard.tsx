'use client'

import {
  Trash2,
  Phone,
  MapPin,
  Pencil,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/format'

export interface CustomerWithStats {
  id: string
  name: string
  phone?: string
  address?: string
  notes?: string
  createdAt?: string
  creditLimit?: number
  loyaltyPoints?: number
  openingBalance?: number
  totalSales: number
  totalPaid: number
  totalRemaining: number
  salesCount: number
}

interface CustomerCardProps {
  customer: CustomerWithStats
  onEdit: () => void
  onDelete: () => void
  onShowReport: () => void
}

export function CustomerCard({
  customer: c,
  onEdit,
  onDelete,
  onShowReport,
}: CustomerCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
            {c.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{c.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {c.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {c.phone}
                </span>
              )}
              {c.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {c.address}
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
            title="تقرير العميل"
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
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-emerald-700">إجمالي المبيعات</p>
          <p className="font-bold text-emerald-900">{formatCurrency(c.totalSales)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-blue-700">المدفوع</p>
          <p className="font-bold text-blue-900">{formatCurrency(c.totalPaid)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-amber-700">المتبقي</p>
          <p className="font-bold text-amber-900">{formatCurrency(c.totalRemaining)}</p>
        </div>
      </div>
    </div>
  )
}
