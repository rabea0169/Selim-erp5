'use client'

import { useState } from 'react'
import { Trash2, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/format'
import { PrintButton } from '../PrintButton'
import type { Purchase } from '@/lib/db'
import { buildPurchasePrintHtml } from './PurchasePrintHelpers'

interface PurchaseCardProps {
  purchase: Purchase
  onDelete: (id: string) => void
}

export function PurchaseCard({ purchase, onDelete }: PurchaseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [printHtml, setPrintHtml] = useState('')
  const remaining = purchase.total - purchase.paid

  const handlePrintClick = async () => {
    const html = await buildPurchasePrintHtml(purchase)
    setPrintHtml(html)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center justify-between text-right">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-slate-800">{purchase.supplierName}</span>
            {purchase.invoiceNo && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">#{purchase.invoiceNo}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Calendar className="w-3 h-3" />
            {formatDate(purchase.date)}
          </div>
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-amber-700">{formatCurrency(purchase.total)}</p>
          <p className="text-[10px] text-slate-500">{purchase.items.length} صنف</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
          <div className="space-y-1">
            {purchase.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg p-2 border border-slate-100">
                <div>
                  <p className="font-medium text-slate-700">{it.itemName}</p>
                  <p className="text-[10px] text-slate-500">{it.quantity} × {formatCurrency(it.unitPrice)}</p>
                </div>
                <p className="font-bold text-slate-700">{formatCurrency(it.total)}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-amber-50 rounded-lg p-2 text-center"><p className="text-[10px] text-amber-700">الإجمالي</p><p className="font-bold text-amber-900">{formatCurrency(purchase.total)}</p></div>
            <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-[10px] text-blue-700">المدفوع</p><p className="font-bold text-blue-900">{formatCurrency(purchase.paid)}</p></div>
            <div className="bg-rose-50 rounded-lg p-2 text-center"><p className="text-[10px] text-rose-700">المتبقي</p><p className="font-bold text-rose-900">{formatCurrency(remaining)}</p></div>
          </div>
          {printHtml ? (
            <PrintButton
              contentHtml={printHtml}
              title={`فاتورة مشتريات - ${purchase.supplierName}`}
              variant="outline"
              size="sm"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
              label="🖨️ طباعة الفاتورة"
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintClick}
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              🖨️ تحضير للطباعة
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onDelete(purchase.id)} className="text-rose-600 hover:bg-rose-50 w-full">
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف الفاتورة
          </Button>
        </div>
      )}
    </div>
  )
}
