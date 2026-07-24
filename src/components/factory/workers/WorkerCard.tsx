'use client'

import { useState } from 'react'
import {
  Trash2,
  Phone,
  Briefcase,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  workerRepository,
  workerAdvanceRepository,
  workerReceiptRepository,
  dataChangeEmitter,
} from '@/lib/db'
import { WorkerReportModal } from '../WorkerReportModal'
import { TransactionForm } from './TransactionForm'
import type { WorkerWithStats } from './types'

interface WorkerCardProps {
  worker: WorkerWithStats
  onChanged: () => void
}

export function WorkerCard({ worker, onChanged }: WorkerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const { toast } = useToast()

  const handleDeleteAdvance = async (id: string) => {
    if (!confirm('حذف هذه السلفة؟')) return
    try {
      await workerAdvanceRepository.delete(id)
      dataChangeEmitter.notifyDelete('workerAdvances')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const handleDeleteReceipt = async (id: string) => {
    if (!confirm('حذف هذا القبض؟')) return
    try {
      await workerReceiptRepository.delete(id)
      dataChangeEmitter.notifyDelete('workerReceipts')
      toast({ title: 'تم الحذف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const handleDeleteWorker = async () => {
    if (!confirm(`حذف الموظف ${worker.name} وكل سجلاته؟`)) return
    try {
      await workerRepository.deleteWithRelations(worker.id)
      dataChangeEmitter.notifyDelete('workers')
      toast({ title: 'تم حذف الموظف' })
    } catch {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
            {worker.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-slate-800">{worker.name}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              {worker.job && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {worker.job}
                </span>
              )}
              {worker.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {worker.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-left">
          <Badge
            variant="outline"
            className={
              worker.balance > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : worker.balance < 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-600'
            }
          >
            رصيد: {formatCurrency(worker.balance)}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-rose-50 rounded-lg p-2">
              <p className="text-[10px] text-rose-700">إجمالي السلف</p>
              <p className="font-bold text-rose-900">{formatCurrency(worker.totalAdvances)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-2">
              <p className="text-[10px] text-emerald-700">إجمالي القبض</p>
              <p className="font-bold text-emerald-900">{formatCurrency(worker.totalReceipts)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              onClick={() => setAdvanceOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 ml-1" />
              تسجيل سلفة
            </Button>
            <Button
              size="sm"
              onClick={() => setReceiptOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 ml-1" />
              تسجيل قبض
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => setReportOpen(true)}
            className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white h-8 text-xs"
          >
            <FileText className="w-3.5 h-3.5 ml-1" />
            تقرير الموظف الكامل (PDF + واتساب)
          </Button>

          {/* Advances history */}
          {worker.advances.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">آخر السلف</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {worker.advances.slice(0, 5).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between bg-white rounded-lg p-2 text-xs border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-rose-700">- {formatCurrency(a.amount)}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(a.date)}
                        {a.notes && ` • ${a.notes}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-rose-500"
                      onClick={() => handleDeleteAdvance(a.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipts history */}
          {worker.receipts.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">آخر القبض</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {worker.receipts.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-white rounded-lg p-2 text-xs border border-slate-100"
                  >
                    <div>
                      <p className="font-bold text-emerald-700">+ {formatCurrency(r.amount)}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDate(r.date)}
                        {r.notes && ` • ${r.notes}`}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-rose-500"
                      onClick={() => handleDeleteReceipt(r.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {worker.notes && (
            <div className="bg-yellow-50 rounded-lg p-2 text-xs text-slate-700">
              <span className="font-bold">ملاحظات: </span>
              {worker.notes}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteWorker}
            className="text-rose-600 hover:bg-rose-50 w-full text-xs"
          >
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف الموظف
          </Button>
        </div>
      )}

      <TransactionForm
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        worker={worker}
        type="advance"
        onSaved={() => setAdvanceOpen(false)}
      />
      <TransactionForm
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        worker={worker}
        type="receipt"
        onSaved={() => setReceiptOpen(false)}
      />
      {reportOpen && (
        <WorkerReportModal worker={worker} onClose={() => setReportOpen(false)} />
      )}
    </div>
  )
}
