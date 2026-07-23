'use client'

import { useState } from 'react'
import { Printer, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PrintSettingsDialog } from './PrintSettingsDialog'
import { printDocument, getSavedPrintSettings, type PrintSettings } from '@/lib/printer'

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

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const currentSettings = getSavedPrintSettings()
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
              dangerouslySetInnerHTML={{ __html: contentHtml }}
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
