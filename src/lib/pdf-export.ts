'use client'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * تحويل عنصر HTML إلى ملف PDF وتنزيله
 * يدعم العربية لأن المتصفح هو من يرسم النص
 */
export async function exportElementToPDF(
  element: HTMLElement,
  filename: string = 'report.pdf'
): Promise<File> {
  // التقاط صورة للعنصر
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  // إضافة الصفحة الأولى
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pdfHeight

  // إضافة صفحات إضافية إذا كان المحتوى طويلاً
  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pdfHeight
  }

  // حفظ الملف
  const pdfBlob = pdf.output('blob')
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

  // تنزيل الملف أيضاً
  pdf.save(filename)

  return file
}

/**
 * مشاركة ملف عبر الواتساب باستخدام Web Share API
 * يعمل على المتصفحات الحديثة في الموبايل
 */
export async function shareViaWhatsApp(
  file: File,
  text: string = 'تقرير من نظام إدارة المصنع'
): Promise<boolean> {
  // محاولة استخدام Web Share API (يدعم الموبايل)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'تقرير المصنع',
        text,
        files: [file],
      })
      return true
    } catch (err: any) {
      if (err.name === 'AbortError') return false
      // في حالة الفشل نستخدم الطريقة البديلة
    }
  }

  // طريقة بديلة: تنزيل الملف وفتح الواتساب بنص جاهز
  // الملف تم تنزيله بالفعل من exportElementToPDF
  const waUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n(يتم إرفاق ملف PDF الذي تم تنزيله)')}`
  window.open(waUrl, '_blank')
  return true
}

/**
 * فتح الواتساب برسالة نصية لمبلغ معين
 */
export function openWhatsAppMessage(phone: string, message: string) {
  const cleanPhone = phone.replace(/[^0-9]/g, '')
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  window.open(waUrl, '_blank')
}

/**
 * إنشاء عنصر HTML مخفي يحتوي على تقرير منسق للتصدير
 */
export function createReportContainer(title: string, contentHtml: string): HTMLElement {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '800px'
  container.style.backgroundColor = '#ffffff'
  container.style.padding = '40px'
  container.style.fontFamily = 'Tahoma, Arial, sans-serif'
  container.style.direction = 'rtl'
  container.innerHTML = `
    <div style="border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1 style="color: #1e293b; margin: 0; font-size: 24px;">${title}</h1>
        <p style="color: #64748b; margin: 4px 0 0; font-size: 12px;">تاريخ التقرير: ${new Date().toLocaleString('ar-EG')}</p>
      </div>
      <div style="text-align: left;">
        <p style="color: #059669; margin: 0; font-weight: bold; font-size: 14px;">نظام إدارة المصنع</p>
        <p style="color: #94a3b8; margin: 2px 0 0; font-size: 11px;">${new Date().toLocaleDateString('ar-EG')}</p>
      </div>
    </div>
    ${contentHtml}
    <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 12px; text-align: center; color: #94a3b8; font-size: 10px;">
      تم إنشاء هذا التقرير بواسطة نظام إدارة مصنع الملابس
    </div>
  `
  document.body.appendChild(container)
  return container
}

/**
 * تنظيف العنصر المؤقت
 */
export function cleanupContainer(container: HTMLElement) {
  if (container.parentNode) {
    container.parentNode.removeChild(container)
  }
}
