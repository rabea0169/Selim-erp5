'use client'

import { formatCurrency } from '@/lib/format'

interface SummaryCardProps {
  label: string
  value: number
  icon: any
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'blue'
  count: number
}

export function SummaryCard({ label, value, icon: Icon, color, count }: SummaryCardProps) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
  }
  return (
    <div className={`rounded-xl p-3 border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium opacity-80">{label}</p>
        <Icon className="w-3.5 h-3.5 opacity-70" />
      </div>
      <p className="text-sm font-bold">{formatCurrency(value)}</p>
      <p className="text-[10px] opacity-60 mt-0.5">{count} عملية</p>
    </div>
  )
}
