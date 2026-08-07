import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'
import { requireCompanyAdmin, requireCompanyScope } from '@/lib/company-scope'
import { safeError } from '@/lib/safe-error'

export async function GET() {
  try {
    const scope = await requireCompanyScope()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const settings = await db.factorySettings.findUnique({
      where: { companyId: scope.companyId },
    })

    return NextResponse.json({ settings })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const scope = await requireCompanyAdmin()
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
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
      where: { companyId: scope.companyId },
      update: data,
      create: {
        ...data,
        companyId: scope.companyId,
      },
    })

    return NextResponse.json({ settings })
  } catch (e) {
    const { error, status } = safeError(e)
    return NextResponse.json({ error }, { status })
  }
}
