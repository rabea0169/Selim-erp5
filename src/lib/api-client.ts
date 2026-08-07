'use client'

/**
 * API Client — generic fetch wrapper for server API access
 * Normalizes all paths to prevent duplicate /api/api/ prefix issues
 */

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('/api/')) return path
  if (path.startsWith('api/')) return `/${path}`
  return `/api${path.startsWith('/') ? path : `/${path}`}`
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = 'حدث خطأ أثناء التواصل مع السيرفر'
    try {
      const body = await response.json()
      if (body.error) message = body.error
    } catch {
      if (response.status === 401) message = 'غير مصرح — يجب تسجيل الدخول أولاً'
      else if (response.status === 403) message = 'غير مصرح — صلاحيات غير كافية'
      else if (response.status === 404) message = 'المسار المطلوب غير موجود على السيرفر'
      else if (response.status === 429) message = 'طلبات كثيرة جداً. حاول لاحقاً'
      else if (response.status >= 500) message = 'خطأ داخلي في السيرفر. حاول مرة أخرى'
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

/** GET request */
export async function apiGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const fullPath = normalizePath(path)
  const url = new URL(fullPath, window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value)
      }
    }
  }
  const response = await fetch(url.toString(), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  return handleResponse<T>(response)
}

/** POST request */
export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const fullPath = normalizePath(path)
  const response = await fetch(fullPath, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

/** PUT request */
export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const fullPath = normalizePath(path)
  const response = await fetch(fullPath, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(response)
}

/** DELETE request */
export async function apiDelete(path: string): Promise<void> {
  const fullPath = normalizePath(path)
  const response = await fetch(fullPath, {
    method: 'DELETE',
    credentials: 'include',
  })
  return handleResponse<void>(response)
}

export { ApiError }
