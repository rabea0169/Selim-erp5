import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, phone, address, notes } = body
    const supplier = await db.supplier.update({
      where: { id },
      data: { name, phone: phone || null, address: address || null, notes: notes || null },
    })
    return NextResponse.json({ supplier })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.supplier.update({
      where: { id },
      data: { purchases: { set: [] } },
    })
    await db.supplier.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
