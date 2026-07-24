'use client'

import { Calendar, Receipt } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'

interface TransactionListProps {
  items: any[]
  empty: string
  titleKey: string | ((item: any) => string)
  amountKey: string
  dateKey: string
  color: 'emerald' | 'rose' | 'amber' | 'purple' | 'blue'
  extra?: (item: any) => React.ReactNode
}

export function TransactionList({
  items,
  empty,
  titleKey,
  amountKey,
  dateKey,
  color,
  extra,
}: TransactionListProps) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    blue: 'text-blue-700',
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center border border-slate-100">
        <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">{empty}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="max-h-96 overflow-y-auto">
        {items.map((item, i) => {
          const title = typeof titleKey === 'function' ? titleKey(item) : item[titleKey]
          const amount = item[amountKey]
          const date = item[dateKey]
          return (
            <div
              key={item.id || i}
              className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(date)}
                  </span>
                  {extra && extra(item)}
                </div>
              </div>
              <p className={`text-sm font-bold ${colors[color]}`}>
                {formatCurrency(amount)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
