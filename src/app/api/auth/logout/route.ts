import { NextResponse } from 'next/server'
import { logoutUser } from '@/lib/auth'
import { serverError } from '@/lib/api'

export async function POST() {
  try {
    await logoutUser()
    return NextResponse.json({ success: true })
  } catch (e) {
    return serverError(e)
  }
}
