'use client'

import { useState } from 'react'
import { Trash2, Calendar, HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { PrintButton } from '../PrintButton'
import type { Sale } from '@/lib/db'
import { buildSalePrintHtml } from './SalePrintHelpers'
import { CustomerPaymentDialog } from './CustomerPaymentDialog'

interface SaleCardProps {
  sale: Sale
  onDelete: (id: string) => void
  onPay?: (sale: Sale) => void
}

export function SaleCard({ sale, onDelete, onPay }: SaleCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [printHtml, setPrintHtml] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const remaining = sale.total - sale.paid

  const handlePrintClick = async () => {
    const html = await buildSalePrintHtml(sale)
    setPrintHtml(html)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between text-right"
      >
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-slate-800">{sale.customerName}</span>
              {sale.invoiceNo && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  #{sale.invoiceNo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Calendar className="w-3 h-3" />
              {formatDate(sale.date)}
            </div>
          </div>
        </div>
        <div className="text-left flex items-center gap-2">
          {remaining > 0 && !expanded && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
            >
              متبقي {formatCurrency(remaining)}
            </Badge>
          )}
          <div>
            <p className="text-sm font-bold text-emerald-700">{formatCurrency(sale.total)}</p>
            <p className="text-[10px] text-slate-500">{sale.items.length} صنف</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-2">
          <div className="space-y-1">
            {sale.items.map((it, i) => (
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
            <div className="bg-emerald-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-emerald-700">الإجمالي</p>
              <p className="font-bold text-emerald-900">{formatCurrency(sale.total)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-700">المدفوع</p>
              <p className="font-bold text-blue-900">{formatCurrency(sale.paid)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-700">المتبقي</p>
              <p className="font-bold text-amber-900">{formatCurrency(remaining)}</p>
            </div>
          </div>

          {/* زر استلام دفعة */}
          {remaining > 0 && (
            <Button
              size="sm"
              onClick={() => setPaymentOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
            >
              <HandCoins className="w-4 h-4 ml-1" />
              استلام دفعة ({formatCurrency(remaining)})
            </Button>
          )}

          {printHtml ? (
            <PrintButton
              contentHtml={printHtml}
              title={`فاتورة مبيعات - ${sale.customerName}`}
              variant="outline"
              size="sm"
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              label="طباعة الفاتورة"
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintClick}
              className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              تحضير للطباعة
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={() => onDelete(sale.id)} className="text-rose-600 hover:bg-rose-50 w-full">
            <Trash2 className="w-3.5 h-3.5 ml-1" />
            حذف الفاتورة
          </Button>
        </div>
      )}

      {/* نافذة استلام الدفعة */}
      <CustomerPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        sale={sale}
      />
    </div>
  )
}
