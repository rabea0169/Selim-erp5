// ====== عميل موحّد لطلبات الـ API مع تمرير الأخطاء بشكل صحيح ======

export class ApiError extends Error {
  readonly status: number
  readonly url: string

  constructor(message: string, status: number, url: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.url = url
  }
}

export async function apiFetch<T = any>(url: string, opts?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
  } catch (e) {
    throw new ApiError(`تعذر الاتصال بالخادم: ${(e as Error).message}`, 0, url)
  }

  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new ApiError(`استجابة غير صالحة من الخادم (${res.status})`, res.status, url)
  }

  if (!res.ok || data?.error) {
    throw new ApiError(data?.error || `فشل الطلب (${res.status})`, res.status, url)
  }
  return data as T
}
