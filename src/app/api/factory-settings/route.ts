import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

const DEFAULT_SETTINGS = {
  factoryName: 'Selim ERP',
  factoryNameEn: '',
  slogan: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  taxNumber: '',
  commercialRegister: '',
  logo: '',
  currency: 'ج.م',
  invoicePrefix: 'INV-',
  invoiceFooter: '',
  defaultPaperSize: 'A4',
  taxRate: 0,
}

// دالة للتحقق من صحة البريد الإلكتروني
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// دالة للتحقق من صحة رقم الهاتف
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\d{10,}$/
  return phoneRegex.test(phone.replace(/\D/g, ''))
}

export async function GET() {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ settings: null })
    const companyId = scope.companyId

    let settings = await db.factorySettings.findFirst({
      where: { companyId },
    })

    if (!settings) {
      settings = await db.factorySettings.findFirst()
    }

    if (!settings) {
      return NextResponse.json({ id: companyId, companyId, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() })
    }

    return NextResponse.json({ ...settings, id: settings.companyId || companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
    
    const user = scope.user
    if (!user) return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'غير مصرح — يتطلب صلاحيات مدير' }, { status: 403 })
    }

    const companyId = scope.companyId
    const body = await req.json()

    // التحقق من البيانات المطلوبة
    if (!body.factoryName?.trim()) {
      return NextResponse.json(
        { error: 'اسم المصنع مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من صحة البريد الإلكتروني إن وجد
    if (body.email && body.email.trim() && !isValidEmail(body.email.trim())) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صحيح' }, { status: 400 })
    }

    // التحقق من صحة رقم الهاتف
    if (body.phone && body.phone.trim() && !isValidPhone(body.phone.trim())) {
      return NextResponse.json({ error: 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل' }, { status: 400 })
    }

    // التحقق من صحة رقم WhatsApp
    if (body.whatsapp && body.whatsapp.trim() && !isValidPhone(body.whatsapp.trim())) {
      return NextResponse.json({ error: 'رقم WhatsApp يجب أن يكون 10 أرقام على الأقل' }, { status: 400 })
    }

    // التحقق من صحة معدل الضريبة
    const taxRate = body.taxRate != null ? Number(body.taxRate) : 0
    if (taxRate < 0 || taxRate > 100) {
      return NextResponse.json({ error: 'معدل الضريبة يجب أن يكون بين 0 و 100' }, { status: 400 })
    }

    const payload = {
      factoryName: body.factoryName.trim(),
      factoryNameEn: body.factoryNameEn?.trim() || null,
      slogan: body.slogan?.trim() || null,
      phone: body.phone?.trim() || null,
      whatsapp: body.whatsapp?.trim() || null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      taxNumber: body.taxNumber?.trim() || null,
      commercialRegister: body.commercialRegister?.trim() || null,
      logo: body.logo || null,
      currency: body.currency?.trim() || 'ج.م',
      invoicePrefix: body.invoicePrefix?.trim() || 'INV-',
      invoiceFooter: body.invoiceFooter?.trim() || null,
      defaultPaperSize: body.defaultPaperSize?.trim() || 'A4',
      taxRate: taxRate,
    }

    // البحث عن السجل الموجود
    const existing = await db.factorySettings.findFirst({
      where: { companyId },
    })

    let settings: any = null

    if (existing) {
      // تحديث السجل الموجود باستخدام ID بدلاً من updateMany
      settings = await db.factorySettings.update({
        where: { id: existing.id },
        data: payload,
      })
    } else {
      // إنشاء سجل جديد
      settings = await db.factorySettings.create({
        data: {
          companyId,
          ...payload,
        },
      })
    }

    return NextResponse.json({ ...settings, id: companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
