import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/lib/auth'
import { jsonError, serverError } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { username, password } = body

    if (!username || !password) {
      return jsonError('اسم المستخدم وكلمة المرور مطلوبان')
    }

    const result = await loginUser(username, password)
    if (!result.success) {
      return jsonError(result.error || '', 401)
    }

    return NextResponse.json({ user: result.user })
  } catch (e) {
    return serverError(e)
  }
}
