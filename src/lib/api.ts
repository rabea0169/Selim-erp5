import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthContext } from './require-auth'
import { PermissionAction } from './permissions'

// ====== استجابات موحّدة (unified JSON responses) ======
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function notFound(message: string) {
  return jsonError(message, 404)
}

// ====== معالجة أخطاء الخادم (500) ======
export function serverError(e: unknown) {
  const message = e instanceof Error ? e.message : String(e)
  return NextResponse.json({ error: message }, { status: 500 })
}

// ====== باراميترات الترقيم (pagination query parsing) ======
export function getPagination(searchParams: URLSearchParams, defaultLimit = 25) {
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || defaultLimit
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

// ====== غلاف: try/catch موحّد للمسارات غير المحمية ======
export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response> | Response,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (e) {
      return serverError(e)
    }
  }
}

// ====== غلاف: مصادقة + صلاحية + try/catch موحّد ======
export type AuthHandlerContext<P> = { auth: AuthContext; params: P; req: NextRequest }

export function withAuth<P = Record<string, never>>(
  action: PermissionAction,
  handler: (ctx: AuthHandlerContext<P>) => Promise<Response> | Response,
) {
  return async (req: NextRequest, ctx?: { params?: Promise<P> }): Promise<Response> => {
    try {
      const auth = await requireAuth(action)
      if (!auth.authorized) return auth.response
      const params = ctx?.params ? await ctx.params : ({} as P)
      return await handler({ auth, params, req })
    } catch (e) {
      return serverError(e)
    }
  }
}
