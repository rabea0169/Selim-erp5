'use client'

import { escapeHtml } from '@/lib/escape-html'

/**
 * نظام الطباعة الاحترافي
 * يدعم:
 * - الطابعات الحرارية (ESC/POS) عبر البلوتوث و WiFi
 * - الطابعات العادية عبر Web Print API
 * - أنواع ورق مختلفة (A4, A5, 80mm, 58mm حراري)
 */

export type PaperSize = 'A4' | 'A5' | 'A6' | 'THERMAL_80' | 'THERMAL_58'

export interface PaperSizeConfig {
  key: PaperSize
  label: string
  description: string
  width: number // بالـ mm
  height?: number // بالـ mm (للورق الحراري غير محدد)
  type: 'paper' | 'thermal'
  icon: string
}

export const PAPER_SIZES: PaperSizeConfig[] = [
  {
    key: 'A4',
    label: 'A4 (عادي)',
    description: 'ورق A4 قياسي 210×297 ملم',
    width: 210,
    height: 297,
    type: 'paper',
    icon: '📄',
  },
  {
    key: 'A5',
    label: 'A5 (نصف)',
    description: 'ورق A5 صغير 148×210 ملم',
    width: 148,
    height: 210,
    type: 'paper',
    icon: '📃',
  },
  {
    key: 'A6',
    label: 'A6 (إيصال)',
    description: 'ورق A6 صغير 105×148 ملم',
    width: 105,
    height: 148,
    type: 'paper',
    icon: '🧾',
  },
  {
    key: 'THERMAL_80',
    label: 'حراري 80 ملم',
    description: 'ورق حراري 80 ملم (طابعة إيصالات)',
    width: 80,
    type: 'thermal',
    icon: '🖨️',
  },
  {
    key: 'THERMAL_58',
    label: 'حراري 58 ملم',
    description: 'ورق حراري 58 ملم (طابعة صغيرة)',
    width: 58,
    type: 'thermal',
    icon: '🖨️',
  },
]

export type PrintMethod = 'browser' | 'bluetooth' | 'wifi'

export interface PrintSettings {
  paperSize: PaperSize
  method: PrintMethod
  copies: number
}

// ============== Web Bluetooth API ==============
// للطابعات الحرارية Bluetooth (ESC/POS)

export async function isBluetoothSupported(): Promise<boolean> {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

// خدمة ESC/POS الشائعة للطابعات الحرارية
const THERMAL_PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // خدمة شائعة للطابعات الحرارية
  '00001101-0000-1000-8000-00805f9b34fb', // SPP
  '0000ff00-0000-1000-8000-00805f9b34fb',
]

const THERMAL_PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

let connectedPrinter: any = null

export async function connectBluetoothPrinter(): Promise<{
  success: boolean
  name?: string
  error?: string
}> {
  if (!(await isBluetoothSupported())) {
    return {
      success: false,
      error: 'متصفحك لا يدعم البلوتوث. استخدم Chrome على الأندرويد.',
    }
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ services: THERMAL_PRINTER_SERVICE_UUIDS }],
      optionalServices: THERMAL_PRINTER_SERVICE_UUIDS,
    })

    const server = await device.gatt.connect()

    // تجربة كل الخدمات للعثور على الطابعة
    let characteristic = null
    for (const serviceUuid of THERMAL_PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid)
        characteristic = await service.getCharacteristic(
          THERMAL_PRINTER_CHARACTERISTIC_UUID
        )
        break
      } catch {
        continue
      }
    }

    if (!characteristic) {
      // محاولة البحث عن أي characteristic قابلة للكتابة
      for (const serviceUuid of THERMAL_PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid)
          const characteristics = await service.getCharacteristics()
          const writable = characteristics.find(
            (c: any) => c.properties.write || c.properties.writeWithoutResponse
          )
          if (writable) {
            characteristic = writable
            break
          }
        } catch {
          continue
        }
      }
    }

    if (!characteristic) {
      return { success: false, error: 'لم يتم العثور على خصائص الطباعة في الجهاز' }
    }

    connectedPrinter = { device, characteristic }
    return { success: true, name: device.name || 'طابعة حرارية' }
  } catch (e: any) {
    if (e.name === 'NotFoundError') {
      return { success: false, error: 'لم يتم اختيار أي جهاز' }
    }
    return { success: false, error: e.message }
  }
}

export async function disconnectBluetoothPrinter() {
  if (connectedPrinter?.device?.gatt?.connected) {
    connectedPrinter.device.gatt.disconnect()
  }
  connectedPrinter = null
}

export function isPrinterConnected(): boolean {
  return connectedPrinter !== null
}

// ============== أوامر ESC/POS ==============
// توليد أوامر ESC/POS للطابعات الحرارية

export function encodeESCPOS(text: string, paperWidth: number = 80): Uint8Array {
  const commands: number[] = []

  // ESC @ - تهيئة الطابعة
  commands.push(0x1b, 0x40)

  // ضبط المحاذاة لليمين (RTL)
  commands.push(0x1b, 0x61, 0x32) // center temporarily; many printers handle RTL via char order

  // ضبط حجم الخط
  // GS ! n - حجم الخط (0 = عادي)
  commands.push(0x1d, 0x21, 0x00)

  // تحويل النص لـ bytes (نستخدم CP1256/windows-1256 للعربية لو الطابعة تدعمها)
  // معظم الطابعات الحرارية تدعم ASCII فقط، فالنص العربي ممكن ما يظهرش بشكل صحيح
  // لكن الطابعات الحديثة بتدعم encoding مختلف - نستخدم UTF-8 كfallback
  const encoder = new TextEncoder()
  const textBytes = encoder.encode(text)
  commands.push(...Array.from(textBytes))

  // سطر جديد
  commands.push(0x0a)

  // قص الورق
  commands.push(0x1d, 0x56, 0x00)

  return new Uint8Array(commands)
}

async function sendToBluetoothPrinter(data: Uint8Array): Promise<boolean> {
  if (!connectedPrinter) return false
  try {
    // تقسيم البيانات لو كبيرة
    const CHUNK_SIZE = 180
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE)
      await connectedPrinter.characteristic.writeValue(chunk)
    }
    return true
  } catch (e) {
    console.error('Bluetooth print error:', e)
    return false
  }
}

// ============== الطباعة عبر الطابعة العادية (Browser) ==============

export async function printViaBrowser(
  contentHtml: string,
  paperSize: PaperSize,
  title: string = 'مستند'
): Promise<void> {
  const config = PAPER_SIZES.find((p) => p.key === paperSize)
  if (!config) return

  // إنشاء نافذة طباعة جديدة
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    alert('الرجاء السماح بالنوافذ المنبثقة للطباعة')
    return
  }

  // تحديد أبعاد الورق
  const isLandscape = false
  const pageWidth = config.width
  const pageHeight = config.height || 'auto'

  // CSS حسب نوع الورق
  let pageCss = ''
  if (config.type === 'thermal') {
    // للورق الحراري - عرض فقط بدون ارتفاع محدد
    pageCss = `
      @page {
        size: ${pageWidth}mm auto;
        margin: 2mm;
      }
      body {
        width: ${pageWidth - 4}mm;
        margin: 0;
        padding: 0;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
      }
      .print-content {
        width: 100%;
        font-size: 11px;
      }
    `
  } else {
    // للورق العادي (A4, A5, A6)
    pageCss = `
      @page {
        size: ${pageWidth}mm ${pageHeight}mm ${isLandscape ? 'landscape' : 'portrait'};
        margin: 8mm;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Cairo', 'Tahoma', 'Arial', sans-serif;
        direction: rtl;
      }
      .print-content {
        width: 100%;
      }
    `
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(title)}</title>
      <style>
        ${pageCss}
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          color: #000;
          font-size: 12px;
          line-height: 1.5;
        }
        h1, h2, h3 { color: #000; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        /* تكرار رأس الجدول في كل صفحة ومنع انقسام الصفوف بين الصفحات */
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th, td {
          border: 1px solid #000;
          padding: 4px 6px;
          text-align: right;
        }
        th {
          background: #f0f0f0;
          font-weight: bold;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .footer {
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px dashed #000;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        .total-row {
          background: #f8f8f8;
          font-weight: bold;
        }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="print-content">
        ${contentHtml}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 300);
        };
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

// ============== الطباعة الرئيسية ==============

export async function printDocument(
  contentHtml: string,
  settings: PrintSettings,
  title: string = 'مستند',
  plainText?: string
): Promise<{ success: boolean; error?: string }> {
  const config = PAPER_SIZES.find((p) => p.key === settings.paperSize)
  if (!config) {
    return { success: false, error: 'حجم ورق غير معروف' }
  }

  // نسخ متعددة
  for (let i = 0; i < settings.copies; i++) {
    if (settings.method === 'bluetooth') {
      // طباعة عبر البلوتوث (ESC/POS)
      if (!connectedPrinter) {
        return {
          success: false,
          error: 'لا توجد طابعة بلوتوث متصلة. اتصل بالطابعة أولاً.',
        }
      }
      const text = plainText || stripHtml(contentHtml)
      const escData = encodeESCPOS(text, config.width)
      const ok = await sendToBluetoothPrinter(escData)
      if (!ok) {
        return { success: false, error: 'فشل إرسال البيانات للطابعة' }
      }
    } else {
      // طباعة عبر المتصفح (browser print)
      await printViaBrowser(contentHtml, settings.paperSize, title)
    }
  }

  return { success: true }
}

// إزالة HTML وتحويل لنص بسيط
function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// ============== إعدادات الطابعة المحفوظة ==============

const SETTINGS_KEY = 'factory_print_settings'

/**
 * تحويل قيمة حجم الورق (من إعدادات المصنع أو التخزين المحلي)
 * لمفتاح PaperSize معروف — تقبل 'A4'/'a4'/'80mm'/'58'... إلخ
 */
export function normalizePaperSize(value?: string | null): PaperSize {
  const v = (value || '').toString().trim().toUpperCase()
  if (v === 'A4' || v === 'A5' || v === 'A6') return v
  if (v === 'THERMAL_80' || v === '80' || v === '80MM') return 'THERMAL_80'
  if (v === 'THERMAL_58' || v === '58' || v === '58MM') return 'THERMAL_58'
  return 'A4'
}

export function getSavedPrintSettings(): PrintSettings {
  if (typeof window === 'undefined') {
    return { paperSize: 'A4', method: 'browser', copies: 1 }
  }
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...parsed, paperSize: normalizePaperSize(parsed.paperSize) }
    }
  } catch (e) {
    console.error('Failed to load print settings:', e)
  }
  return { paperSize: 'A4', method: 'browser', copies: 1 }
}

export function savePrintSettings(settings: PrintSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

/**
 * الإعدادات الافتراضية للطباعة:
 * 1) الإعدادات المحفوظة محلياً (اختارها المستخدم يدوياً) لها الأولوية
 * 2) وإلا defaultPaperSize من إعدادات المصنع (factorySettings)
 * 3) وإلا A4 عبر المتصفح
 */
export async function getDefaultPrintSettings(): Promise<PrintSettings> {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return { ...parsed, paperSize: normalizePaperSize(parsed.paperSize) }
      }
    } catch (e) {
      console.error('Failed to load print settings:', e)
    }
  }
  try {
    const { getFactorySettings } = await import('@/lib/factory-header')
    const fs = await getFactorySettings()
    return {
      paperSize: normalizePaperSize(fs?.defaultPaperSize),
      method: 'browser',
      copies: 1,
    }
  } catch (e) {
    console.error('Failed to load factory print defaults:', e)
  }
  return { paperSize: 'A4', method: 'browser', copies: 1 }
}
