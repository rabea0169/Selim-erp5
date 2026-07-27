import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db-server'

export async function GET() {
  try {
    const settings = await db.factorySettings.findUnique({
      where: { id: 'singleton' },
    })
    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.factoryName?.trim()) {
      return NextResponse.json(
        { error: 'اسم المصنع مطلوب' },
        { status: 400 }
      )
    }

    const settings = await db.factorySettings.upsert({
      where: { id: 'singleton' },
      update: {
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
      },
      create: {
        id: 'singleton',
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
      },
    })

    return NextResponse.json({ settings })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
