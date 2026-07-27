'use client'

import { useState } from 'react'
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Play,
  ListChecks,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { ProductionOrder, ProductionOrderStage } from '@/lib/db'

interface StagesListProps {
  order: ProductionOrder
  isCompleted: boolean
  isCancelled: boolean
  onStartStage: (stageId: string) => void
  onCompleteStage: (stageId: string) => void
}

export function StagesList({
  order,
  isCompleted,
  isCancelled,
  onStartStage,
  onCompleteStage,
}: StagesListProps) {
  if (order.stages.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
        <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
          <ListChecks className="w-3.5 h-3.5" />
          مراحل التصنيع
        </p>
        <p className="text-[11px] text-slate-400 text-center py-2">
          لا توجد مراحل مسجلة
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3">
      <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
        <ListChecks className="w-3.5 h-3.5" />
        مراحل التصنيع
      </p>
      <div className="space-y-2">
        {order.stages.map((s: ProductionOrderStage, idx: number) => {
          const stageStyle =
            s.status === 'completed'
              ? {
                  bg: 'bg-emerald-50',
                  text: 'text-emerald-700',
                  border: 'border-emerald-200',
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                }
              : s.status === 'in_progress'
              ? {
                  bg: 'bg-blue-50',
                  text: 'text-blue-700',
                  border: 'border-blue-200',
                  icon: <Clock className="w-4 h-4 text-blue-600" />,
                }
              : {
                  bg: 'bg-slate-50',
                  text: 'text-slate-600',
                  border: 'border-slate-200',
                  icon: <Circle className="w-4 h-4 text-slate-400" />,
                }
          return (
            <div
              key={s.id}
              className={`rounded-lg p-2 border ${stageStyle.bg} ${stageStyle.border}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {idx + 1}
                  </span>
                  {stageStyle.icon}
                  <div className="flex-1">
                    <p className={`text-xs font-bold ${stageStyle.text}`}>{s.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      {s.startedAt && <span>بدء: {formatDate(s.startedAt)}</span>}
                      {s.completedAt && (
                        <span>إكمال: {formatDate(s.completedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
                {!isCompleted && !isCancelled && (
                  <div className="flex gap-1">
                    {s.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStartStage(s.id)}
                        className="h-7 text-[10px] font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Play className="w-3 h-3 ml-1" />
                        بدء
                      </Button>
                    )}
                    {s.status === 'in_progress' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCompleteStage(s.id)}
                        className="h-7 text-[10px] font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        <Check className="w-3 h-3 ml-1" />
                        إكمال
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
