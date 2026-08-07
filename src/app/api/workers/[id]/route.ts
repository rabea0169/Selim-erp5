import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyScope } from '@/lib/company-scope'
import { db } from '@/lib/db-server'
import { safeError } from '@/lib/safe-error'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, phone, job, type, notes } = body

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'اسم الموظف مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من وجود الموظف
    const existing = await db.worker.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    // Fix S: Validate worker type strictly
    const VALID_WORKER_TYPES = ['monthly', 'production', 'hourly']
    if (type && !VALID_WORKER_TYPES.includes(type)) {
      return NextResponse.json({ error: 'نوع العامل غير صالح' }, { status: 400 })
    }
    const validType = type || 'monthly'

    const worker = await db.worker.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        job: job?.trim() || null,
        type: validType,
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ worker })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // التحقق من وجود الموظف
    const existing = await db.worker.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      )
    }

    // حذف الموظف - سيتم حذف كل السجلات المرتبطة تلقائياً (Cascade)
    await db.worker.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    const { error, status } = safeError(e); return NextResponse.json({ error }, { status })
  }
}
