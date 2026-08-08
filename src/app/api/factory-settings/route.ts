import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { getCurrentUser } from '@/lib/auth'
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

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user?.companyId) {
      return NextResponse.json({ settings: null })
    }
    const companyId = user.companyId
    const settings = await db.factorySettings.findUnique({
      where: { companyId },
    })

    if (!settings) {
      return NextResponse.json({ id: companyId, ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() })
    }

    return NextResponse.json({ ...settings, id: settings.companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح — يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role !== 'admin' && user.role !== 'owner') {
      return NextResponse.json({ error: 'غير مصرح — يتطلب صلاحيات مدير' }, { status: 403 })
    }

    const companyId = user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'لم يتم العثور على شركة مرتبطة بالحساب' }, { status: 400 })
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
      create: {
        companyId,
        ...data,
      },
    })

    return NextResponse.json({ ...settings, id: settings.companyId })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
