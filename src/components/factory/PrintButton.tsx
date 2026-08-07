'use client'

import { useState, useEffect } from 'react'
import { Printer, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PrintSettingsDialog } from './PrintSettingsDialog'
import {
  printDocument,
  getSavedPrintSettings,
  getDefaultPrintSettings,
  type PrintSettings,
} from '@/lib/printer'

function sanitizeHtml(html: string): string {
  // Allow only safe formatting tags and attributes
  const allowedTags = ['div', 'span', 'p', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'style', 'img']
  // Replace script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*\S+/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[^>]*>.*?<\/form>/gi, '')
    .replace(/<input\b[^>]*>/gi, '')
    .replace(/<select\b[^>]*>.*?<\/select>/gi, '')
    .replace(/<textarea\b[^>]*>.*?<\/textarea>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
  return sanitized
}

interface PrintButtonProps {
  contentHtml: string
  title?: string
  plainText?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  label?: string
}

export function PrintButton({
  contentHtml,
  title = 'مستند',
  plainText,
  variant = 'default',
  size = 'default',
  className = '',
  label = 'طباعة',
}: PrintButtonProps) {
  const [printing, setPrinting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [settings, setSettings] = useState<PrintSettings>(getSavedPrintSettings())
  const { toast } = useToast()

  // حجم الورق الافتراضي يُؤخذ من إعدادات المصنع (defaultPaperSize)
  // ما لم يكن المستخدم حفظ إعدادات يدوية على الجهاز
  useEffect(() => {
    let cancelled = false
    getDefaultPrintSettings()
      .then((s) => {
        if (!cancelled) setSettings(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const currentSettings = await getDefaultPrintSettings()
      setSettings(currentSettings)
      const result = await printDocument(contentHtml, currentSettings, title, plainText)
      if (result.success) {
        toast({ title: 'تم', description: 'تم إرسال المستند للطباعة' })
      } else {
        toast({
          title: 'فشل الطباعة',
          description: result.error,
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          variant={variant}
          size={size}
          onClick={() => setShowPreview(true)}
          disabled={printing}
          className={className}
        >
          <Printer className="w-4 h-4 ml-1" />
          {label}
        </Button>
        <Button
          variant="outline"
          size={size === 'icon' ? 'icon' : 'sm'}
          onClick={() => setShowSettings(true)}
          className="border-slate-200"
          title="إعدادات الطباعة"
        >
          <Settings2 className="w-4 h-4" />
        </Button>
      </div>

      <PrintSettingsDialog open={showSettings} onOpenChange={setShowSettings} />

      {/* نافذة المعاينة */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-600" />
              معاينة الطباعة - {title}
            </DialogTitle>
          <DialogDescription className="sr-only">معاينة وطباعة المستند</DialogDescription>
          </DialogHeader>

          <div className="bg-slate-50 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            <div
              className="bg-white shadow-md mx-auto p-4"
              style={{
                maxWidth:
                  settings.paperSize === 'THERMAL_58'
                    ? '220px'
                    : settings.paperSize === 'THERMAL_80'
                    ? '300px'
                    : settings.paperSize === 'A6'
                    ? '350px'
                    : settings.paperSize === 'A5'
                    ? '500px'
                    : '700px',
                fontFamily: 'Tahoma, Arial, sans-serif',
                direction: 'rtl',
              }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(contentHtml) }}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handlePrint}
              disabled={printing}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="w-4 h-4 ml-1" />
              {printing ? 'جارٍ الطباعة...' : `طباعة (${settings.copies} نسخة)`}
            </Button>
            <Button variant="outline" onClick={() => setShowSettings(true)}>
              <Settings2 className="w-4 h-4 ml-1" />
              إعدادات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
