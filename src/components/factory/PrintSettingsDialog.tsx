'use client'

import { useState, useEffect } from 'react'
import {
  Printer,
  Bluetooth,
  Wifi,
  Monitor,
  Check,
  X,
  RefreshCw,
  Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  PAPER_SIZES,
  type PrintSettings,
  type PrintMethod,
  type PaperSize,
  isBluetoothSupported,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  isPrinterConnected,
  getSavedPrintSettings,
  savePrintSettings,
} from '@/lib/printer'

export function PrintSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [settings, setSettings] = useState<PrintSettings>({
    paperSize: 'A4',
    method: 'browser',
    copies: 1,
  })
  const [bluetoothSupported, setBluetoothSupported] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [printerName, setPrinterName] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    setSettings(getSavedPrintSettings())
    isBluetoothSupported().then(setBluetoothSupported)
    setConnected(isPrinterConnected())
  }, [open])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const result = await connectBluetoothPrinter()
      if (result.success) {
        setConnected(true)
        setPrinterName(result.name || '')
        toast({
          title: 'تم الاتصال',
          description: `تم الاتصال بـ ${result.name}`,
        })
      } else {
        toast({
          title: 'فشل الاتصال',
          description: result.error,
          variant: 'destructive',
        })
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await disconnectBluetoothPrinter()
    setConnected(false)
    setPrinterName('')
    toast({ title: 'تم قطع الاتصال' })
  }

  const handleSave = () => {
    savePrintSettings(settings)
    toast({ title: 'تم الحفظ', description: 'تم حفظ إعدادات الطباعة' })
    onOpenChange(false)
  }

  const methods: { key: PrintMethod; label: string; icon: any; desc: string; available: boolean }[] = [
    {
      key: 'browser',
      label: 'طابعة عادية',
      icon: Monitor,
      desc: 'طباعة عبر متصفح الجهاز (أي طابعة متصلة بالكمبيوتر أو الموبايل)',
      available: true,
    },
    {
      key: 'bluetooth',
      label: 'بلوتوث',
      icon: Bluetooth,
      desc: 'طابعة حرارية عبر البلوتوث (إيصالات)',
      available: bluetoothSupported,
    },
    {
      key: 'wifi',
      label: 'WiFi',
      icon: Wifi,
      desc: 'طابعة عبر الشبكة (يتم استخدام الطابعة الافتراضية)',
      available: true,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-600" />
            إعدادات الطباعة
          </DialogTitle>
          <DialogDescription className="sr-only">إعدادات الطباعة وأنواع الورق</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* نوع الورق */}
          <div>
            <Label className="text-xs font-bold text-slate-700 mb-2 block">
              حجم الورق
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {PAPER_SIZES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSettings({ ...settings, paperSize: p.key as PaperSize })}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right ${
                    settings.paperSize === p.key
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{p.label}</span>
                      {p.type === 'thermal' && (
                        <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200">
                          حراري
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{p.description}</p>
                  </div>
                  {settings.paperSize === p.key && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* طريقة الطباعة */}
          <div>
            <Label className="text-xs font-bold text-slate-700 mb-2 block">
              طريقة الطباعة
            </Label>
            <div className="space-y-2">
              {methods.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.key}
                    disabled={!m.available}
                    onClick={() => setSettings({ ...settings, method: m.key })}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right ${
                      !m.available
                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                        : settings.method === m.key
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${m.available ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="flex-1">
                      <p className="font-bold text-sm text-slate-800">{m.label}</p>
                      <p className="text-[11px] text-slate-500">{m.desc}</p>
                    </div>
                    {settings.method === m.key && m.available && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                    {!m.available && (
                      <Badge variant="outline" className="text-[9px] bg-slate-100">
                        غير مدعوم
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* عدد النسخ */}
          <div>
            <Label className="text-xs font-bold text-slate-700 mb-2 block">
              عدد النسخ
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() =>
                  setSettings({ ...settings, copies: Math.max(1, settings.copies - 1) })
                }
              >
                -
              </Button>
              <div className="flex-1 text-center text-lg font-bold text-slate-800 bg-slate-50 rounded-lg py-2">
                {settings.copies}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() =>
                  setSettings({ ...settings, copies: Math.min(10, settings.copies + 1) })
                }
              >
                +
              </Button>
            </div>
          </div>

          {/* اتصال البلوتوث */}
          {settings.method === 'bluetooth' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-blue-800">
                  اتصال الطابعة
                </Label>
                {connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    متصل {printerName && `• ${printerName}`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    غير متصل
                  </Badge>
                )}
              </div>
              {!bluetoothSupported && (
                <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg">
                  متصفحك لا يدعم البلوتوث. استخدم Chrome على الأندرويد أو Edge.
                </p>
              )}
              {connected ? (
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                  size="sm"
                >
                  قطع الاتصال
                </Button>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !bluetoothSupported}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 ml-1 animate-spin" />
                      جارٍ الاتصال...
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4 ml-1" />
                      الاتصال بطابعة
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* معلومة */}
          <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600">
            <p className="font-bold mb-1">💡 معلومات:</p>
            <ul className="space-y-1 list-disc pr-4">
              <li>للطابعات الحرارية البلوتوث، تأكد من اقترانها مع جهازك أولاً</li>
              <li>الطابعات العادية تعمل على أي جهاز بدون إعدادات إضافية</li>
              <li>يتم حفظ الإعدادات تلقائياً على جهازك</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="w-4 h-4 ml-1" />
            حفظ الإعدادات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
