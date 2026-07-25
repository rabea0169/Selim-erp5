'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Factory,
  Upload,
  Save,
  Trash2,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Hash,
  X,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { factorySettingsRepository, dataChangeEmitter } from '@/lib/db'
import type { FactorySettings } from '@/lib/db/types'

export function FactorySettingsView({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [settings, setSettings] = useState<FactorySettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadSettings = async () => {
    setLoading(true)
    try {
      const s = await factorySettingsRepository.get()
      setSettings(s)
      setLogoPreview(s.logo || '')
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // التحقق من النوع
    if (!file.type.startsWith('image/')) {
      toast({ title: 'خطأ', description: 'الملف يجب أن يكون صورة', variant: 'destructive' })
      return
    }

    // التحقق من الحجم (أقل من 2 ميجا)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'خطأ', description: 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت', variant: 'destructive' })
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setLogoPreview(result)
      setSettings((prev) => prev ? { ...prev, logo: result } : prev)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const removeLogo = () => {
    setLogoPreview('')
    setSettings((prev) => prev ? { ...prev, logo: '' } : prev)
  }

  const handleSave = async () => {
    if (!settings) return
    if (!settings.factoryName.trim()) {
      toast({ title: 'تنبيه', description: 'اسم المصنع مطلوب', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await factorySettingsRepository.update({
        factoryName: settings.factoryName.trim(),
        factoryNameEn: settings.factoryNameEn?.trim() || '',
        slogan: settings.slogan?.trim() || '',
        phone: settings.phone?.trim() || '',
        whatsapp: settings.whatsapp?.trim() || '',
        email: settings.email?.trim() || '',
        address: settings.address?.trim() || '',
        taxNumber: settings.taxNumber?.trim() || '',
        commercialRegister: settings.commercialRegister?.trim() || '',
        logo: settings.logo || '',
        currency: settings.currency?.trim() || 'ج.م',
        invoicePrefix: settings.invoicePrefix?.trim() || 'INV-',
        invoiceFooter: settings.invoiceFooter?.trim() || '',
        defaultPaperSize: settings.defaultPaperSize || 'A4',
      })

      // بث حدث التحديث
      dataChangeEmitter.notifyUpdate('factorySettings')

      toast({ title: 'تم الحفظ', description: 'تم حفظ بيانات المصنع بنجاح' })
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('هل تريد استعادة الإعدادات الافتراضية؟')) return
    try {
      const defaults = await factorySettingsRepository.reset()
      setSettings(defaults)
      setLogoPreview('')
      dataChangeEmitter.notifyUpdate('factorySettings')
      toast({ title: 'تم', description: 'تمت استعادة الإعدادات الافتراضية' })
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' })
    }
  }

  if (loading || !settings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">جارٍ التحميل</DialogTitle>
          <DialogDescription className="sr-only">إدارة بيانات المصنع</DialogDescription>
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Factory className="w-5 h-5 text-amber-600" />
            بيانات المصنع
          </DialogTitle>
          <DialogDescription className="sr-only">إدارة بيانات المصنع وشعاره</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* اللوجو */}
          <div>
            <Label className="text-xs font-bold">شعار المصنع</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50">
                {logoPreview ? (
                  <img src={logoPreview} alt="لوجو" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 ml-1" />
                  رفع شعار
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeLogo}
                    className="w-full text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4 ml-1" />
                    حذف الشعار
                  </Button>
                )}
                <p className="text-[10px] text-slate-500">
                  PNG, JPG (أقل من 2 ميجا)
                </p>
              </div>
            </div>
          </div>

          {/* اسم المصنع */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">اسم المصنع (عربي) *</Label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={settings.factoryName}
                  onChange={(e) => setSettings({ ...settings, factoryName: e.target.value })}
                  placeholder="مصنع الملابس"
                  className="pr-9 bg-slate-50"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">الاسم (إنجليزي)</Label>
              <Input
                value={settings.factoryNameEn || ''}
                onChange={(e) => setSettings({ ...settings, factoryNameEn: e.target.value })}
                placeholder="Factory Name"
                className="bg-slate-50"
                dir="ltr"
              />
            </div>
          </div>

          {/* الشعار النصي */}
          <div>
            <Label className="text-xs">الشعار النصي / الوصف</Label>
            <Input
              value={settings.slogan || ''}
              onChange={(e) => setSettings({ ...settings, slogan: e.target.value })}
              placeholder="الجودة هي هدفنا"
              className="bg-slate-50"
            />
          </div>

          {/* وسائل التواصل */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">الهاتف</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={settings.phone || ''}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="01000000000"
                  className="pr-9 bg-slate-50"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">واتساب</Label>
              <Input
                value={settings.whatsapp || ''}
                onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                placeholder="01000000000"
                className="bg-slate-50"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="info@factory.com"
                  className="pr-9 bg-slate-50"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">العملة</Label>
              <Input
                value={settings.currency || ''}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                placeholder="ج.م"
                className="bg-slate-50"
              />
            </div>
          </div>

          {/* العنوان */}
          <div>
            <Label className="text-xs">العنوان</Label>
            <div className="relative">
              <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="المدينة، المنطقة، الشارع"
                className="pr-9 bg-slate-50"
              />
            </div>
          </div>

          {/* السجلات الرسمية */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">السجل الضريبي</Label>
              <div className="relative">
                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={settings.taxNumber || ''}
                  onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })}
                  placeholder="123-456-789"
                  className="pr-9 bg-slate-50"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">السجل التجاري</Label>
              <Input
                value={settings.commercialRegister || ''}
                onChange={(e) => setSettings({ ...settings, commercialRegister: e.target.value })}
                placeholder="000000"
                className="bg-slate-50"
                dir="ltr"
              />
            </div>
          </div>

          {/* إعدادات الفواتير */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <p className="text-xs font-bold text-slate-700">إعدادات الفواتير</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">بادئة رقم الفاتورة</Label>
                <Input
                  value={settings.invoicePrefix || ''}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  placeholder="INV-"
                  className="bg-white"
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="text-xs">حجم الورق الافتراضي</Label>
                <Input
                  value={settings.defaultPaperSize || 'A4'}
                  onChange={(e) => setSettings({ ...settings, defaultPaperSize: e.target.value })}
                  placeholder="A4"
                  className="bg-white"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">تذييل الفاتورة</Label>
              <Textarea
                value={settings.invoiceFooter || ''}
                onChange={(e) => setSettings({ ...settings, invoiceFooter: e.target.value })}
                placeholder="شكراً لتعاملكم معنا"
                className="bg-white text-sm"
                rows={2}
              />
            </div>
          </div>

          {/* تنبيه */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-[11px] text-blue-800 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p>بيانات المصنع ستظهر تلقائياً في كل الفواتير والمطبوعات والتقارير.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleReset} className="text-slate-500">
            استعادة الافتراضي
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Save className="w-4 h-4 ml-1" />
            {saving ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
