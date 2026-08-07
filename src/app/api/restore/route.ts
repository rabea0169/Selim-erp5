import { NextResponse } from 'next/server'
import { requireCompanyAdmin } from '@/lib/company-scope'

// POST /api/restore - معطل افتراضياً لأن الاسترجاع العالمي كان يمسح بيانات كل الشركات.
// لا يتم إعادة تفعيله إلا بعد إضافة استرجاع مقيد بـ companyId وبنسخة احتياطية موقعة.
export async function POST() {
  const scope = await requireCompanyAdmin()
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status })
  }

  return NextResponse.json(
    {
      error: 'استرجاع البيانات معطل مؤقتاً لحماية بيانات الشركات الأخرى',
      details: 'النسخة القديمة كانت تنفذ deleteMany عاماً على كل الجداول. سيتم إعادة تفعيلها فقط كاسترجاع مقيد بشركة الجلسة.',
    },
    { status: 403 }
  )
}
