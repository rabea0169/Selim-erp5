import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
import { requireAdmin } from '@/lib/admin-check'
import { safeError } from '@/lib/safe-error'

// Fix: المفتاح الأساسي لـ FactorySettings هو companyId وليس id
// كل شركة لها إعداداتها الخاصة (Multi-Tenancy)
// Fix: العقد مع العميل (factorySettingsRepository) يتوقع كائن الإعدادات مباشرة
// وليس مغلفاً بـ { settings } — بدون هذا الإصلاح تظهر صفحة الإعدادات فارغة دائماً

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

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const companyId = user.companyId ?? null
    if (!companyId) {
      // لا توجد شركة — نعيد الإعدادات الافتراضية حتى لا تتعطل الواجهة
      return NextResponse.json({ id: null, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() })
    }

    const settings = await db.factorySettings.findUnique({
      where: { companyId },
    })

    if (!settings) {
      // أول مرة — نعيد الافتراضيات (لا ننشئ سجلاً حتى يحفظ الأدمن)
      return NextResponse.json({ id: companyId, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() })
    }

    // العميل يتوقع id — نمرره من companyId (المفتاح الأساسي)
    return NextResponse.json({ ...settings, id: settings.companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status })
    }

    const companyId = admin.companyId ?? null
    if (!companyId) {
      return NextResponse.json(
        { error: 'لا توجد شركة مرتبطة بهذا المستخدم' },
        { status: 400 }
      )
    }

    const body = await req.json()

    if (!body.factoryName?.trim()) {
      return NextResponse.json(
        { error: 'اسم المصنع مطلوب' },
        { status: 400 }
      )
    }

    const data = {
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
      taxRate: body.taxRate != null ? Number(body.taxRate) : 0,
    }

    const settings = await db.factorySettings.upsert({
      where: { companyId },
      update: data,
      create: { companyId, ...data },
    })

    // نعيد كائن الإعدادات مباشرة كما يتوقع العميل
    return NextResponse.json({ ...settings, id: settings.companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
