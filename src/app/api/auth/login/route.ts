import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const result = await loginUser(username, password)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ user: result.user })
  } catch (e) {
    return handleApiError(e, 'POST /api/auth/login')
  }
}
