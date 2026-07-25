import { NextResponse } from 'next/server'
import { logoutUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api-error'

export async function POST() {
  try {
    await logoutUser()
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e, 'POST /api/auth/logout')
  }
}
