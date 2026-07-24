'use client'

import { useState } from 'react'
import {
  Search,
  ChevronLeft,
  History,
  Layers,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import type { Material, MaterialTransaction } from '@/lib/db'

interface TransactionListProps {
  transactions: MaterialTransaction[]
  materials: Material[]
  onBack: () => void
}

export function TransactionList({
  transactions,
  materials,
  onBack,
}: TransactionListProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const materialMap = new Map(materials.map((m) => [m.id, m]))

  const filtered = transactions.filter((t) => {
    const mat = materialMap.get(t.materialId)
    const matName = mat?.name || '—'
    const matchesSearch =
      !search ||
      matName.toLowerCase().includes(search.toLowerCase()) ||
      t.reason.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || t.type === typeFilter
    return matchesSearch && matchesType
  })

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
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-1">
          <History className="w-4 h-4" />
          حركات المواد
        </h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="بحث باسم المادة أو السبب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-slate-50 border-slate-200"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="bg-slate-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحركات</SelectItem>
            <SelectItem value="in">وارد</SelectItem>
            <SelectItem value="out">منصرف</SelectItem>
            <SelectItem value="transfer">تحويل</SelectItem>
            <SelectItem value="adjustment">تسوية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">لا توجد حركات</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 200).map((t) => {
            const mat = materialMap.get(t.materialId)
            const isIn = t.type === 'in'
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isIn ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {mat?.name || 'مادة محذوفة'}
                    </p>
                    <span
                      className={`text-xs font-bold ${
                        isIn ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIn ? '+' : '-'}
                      {t.quantity} {mat?.unit || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 pr-9">
                    <Calendar className="w-3 h-3" />
                    {formatDate(t.date)}
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      {t.reason}
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length > 200 && (
            <p className="text-center text-[11px] text-slate-400 py-2">
              عرض أول 200 حركة من {filtered.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
