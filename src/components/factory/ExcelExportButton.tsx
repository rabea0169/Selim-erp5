'use client'

import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportToExcel } from '@/lib/excel-export'
import { factorySettingsRepository, type FactorySettings } from '@/lib/db'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// نوع ورقة التصدير - مطابق لـ lib/excel-export.ts
export interface ExcelSheet {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

interface ExcelExportButtonProps {
  /** عنوان التقرير (يظهر في الإشعارات) */
  title: string
  /** أوراق التصدير - كل ورقة لها اسم وعناوين وصفوف */
  sheets: ExcelSheet[]
  /** اسم الملف الناتج بدون امتداد (افتراضي: title) */
  fileName?: string
  /** تسمية الزر (افتراضي: تصدير Excel) */
  label?: string
  /** حجم الزر */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** كلاسات إضافية */
  className?: string
  /** تعطيل الزر */
  disabled?: boolean
  /** شامل بيانات المصنع (افتراضي: true) */
  includeFactoryInfo?: boolean
  /** عرض الأيقونة */
  showIcon?: boolean
  /** variant الزر (افتراضي: default - أخضر) */
  variant?: 'default' | 'outline' | 'ghost'
}

/**
 * زر تصدير Excel للصفحات.
 * يجلب factorySettings تلقائياً ويضيفها كورقة أولى،
 * ثم يصدّر كل الأوراق في ملف Excel واحد.
 */
export function ExcelExportButton({
  title,
  sheets,
  fileName,
  label = 'تصدير Excel',
  size = 'sm',
  className,
  disabled = false,
  includeFactoryInfo = true,
  showIcon = true,
  variant = 'default',
}: ExcelExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const { toast } = useToast()

  const handleExport = async () => {
    if (sheets.length === 0) {
      toast({
        title: 'لا توجد بيانات',
        description: 'لم يتم توفير أوراق بيانات للتصدير',
        variant: 'destructive',
      })
      return
    }

    setExporting(true)
    try {
      // جلب بيانات المصنع
      let factorySettings: FactorySettings | undefined = undefined
      if (includeFactoryInfo) {
        try {
          factorySettings = await factorySettingsRepository.get()
        } catch (e) {
          console.warn('Failed to load factory settings:', e)
          // نكمل بدون بيانات المصنع
        }
      }

      // تنفيذ التصدير
      exportToExcel({
        title,
        factorySettings,
        sheets,
        fileName: fileName || title,
      })

      toast({
        title: 'تم التصدير بنجاح',
        description: `تم إنشاء ملف "${fileName || title}.xlsx"`,
      })
    } catch (e: any) {
      console.error('Excel export error:', e)
      toast({
        title: 'فشل التصدير',
        description: e?.message || 'حدث خطأ غير متوقع',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || exporting}
      size={size}
      variant={variant}
      className={cn(
        // لون أخضر متناسق مع التطبيق
        variant === 'default' &&
          'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0',
        variant === 'outline' &&
          'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30',
        className
      )}
      dir="rtl"
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 ml-1 animate-spin" />
      ) : (
        showIcon && <FileSpreadsheet className="w-4 h-4 ml-1" />
      )}
      {exporting ? 'جارٍ التصدير...' : label}
    </Button>
  )
}
