/**
 * Shared API utilities: auth, error handling, pagination
 * Centralizes boilerplate from 47 route.ts handlers
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, type PermissionAction, type AuthContext } from '@/lib/db/require-auth'

// ===== Response builders =====

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

export function notFound(message: string): NextResponse {
  return jsonError(message, 404)
}

export function serverError(e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : 'خطأ في السيرفر'
  console.error('[API Error]', e)
  // Don't leak Prisma internals in production
  const isProduction = process.env.NODE_ENV === 'production'
  return NextResponse.json(
    { error: isProduction ? 'حدث خطأ في السيرفر' : message },
    { status: 500 }
  )
}

// ===== Pagination =====

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export function getPagination(
  searchParams: URLSearchParams | Record<string, string>,
  defaultLimit = 25
): PaginationParams {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams)
  const page = Math.max(1, parseInt(params.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || String(defaultLimit))))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

// ===== Auth wrapper =====

type AuthParams<P extends Record<string, any> = {}> = {
  auth: AuthContext
  params: P
  req: NextRequest
}

type AuthHandler<P extends Record<string, any> = {}> = (
  ctx: AuthParams<P>
) => Promise<Response>

export function withAuth<P extends Record<string, any> = {}>(
  action: PermissionAction,
  handler: AuthHandler<P>
): (req: NextRequest, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req: NextRequest, { params: paramsPromise }) => {
    try {
      const auth = await requireAuth(action)
      if (!auth.authorized) {
        return auth.response
      }

      const params = await paramsPromise
      return await handler({ auth: auth as AuthContext, params, req })
    } catch (e) {
      return serverError(e)
    }
  }
}

// ===== Generic error handler =====

export function withErrorHandling(
  handler: (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>
) {
  return async (req: NextRequest, ctx: { params: Promise<any> }) => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      return serverError(e)
    }
  }
}
