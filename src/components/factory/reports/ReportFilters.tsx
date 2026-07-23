'use client'

import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ReportFiltersProps {
  from: string
  to: string
  loading: boolean
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onPreset: (preset: 'today' | 'week' | 'month' | 'year') => void
  onReload: () => void
  onPrint: () => void
}

/**
 * فلاتر التقرير: نطاق التاريخ + أزرار سريعة (اليوم/أسبوع/شهر/سنة) +
 * زر "عرض التقرير" + زر "طباعة"
 *
 * ملاحظة: المكوّن يُرجع المحتوى فقط بدون إطار خارجي ليُدمج مع ExportButtons
 * داخل نفس الصندوق الأبيض في ReportsView.
 */
export function ReportFilters({
  from,
  to,
  loading,
  onFromChange,
  onToChange,
  onPreset,
  onReload,
  onPrint,
}: ReportFiltersProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] text-slate-500">من تاريخ</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
            className="bg-slate-50 border-slate-200 text-sm"
          />
        </div>
        <div>
          <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="bg-slate-50 border-slate-200 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('today')}
          className="h-7 text-[11px]"
        >
          اليوم
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('week')}
          className="h-7 text-[11px]"
        >
          آخر أسبوع
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('month')}
          className="h-7 text-[11px]"
        >
          هذا الشهر
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPreset('year')}
          className="h-7 text-[11px]"
        >
          هذا العام
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onReload}
          disabled={loading}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          size="sm"
        >
          <FileText className="w-4 h-4 ml-1" />
          {loading ? 'جارٍ التحديث...' : 'عرض التقرير'}
        </Button>
        <Button
          onClick={onPrint}
          variant="outline"
          size="sm"
          className="border-slate-200"
        >
          <Download className="w-4 h-4 ml-1" />
          طباعة
        </Button>
      </div>
    </>
  )
}
