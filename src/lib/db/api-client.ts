/**
 * Centralized API client with unified error handling
 * Replaces scattered apiFetch implementations
 */

class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 0,
    public url: string = ''
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<{ data: any; status: number }> {
  try {
    const response = await fetch(url, options)
    
    // Handle network/HTTP errors
    let data: any
    const contentType = response.headers.get('content-type')
    
    try {
      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        throw new ApiError(
          'استجابة غير صالحة (HTML بدلاً من JSON)',
          response.status,
          url
        )
      }
    } catch (parseErr) {
      throw new ApiError(
        'فشل تحليل الاستجابة: ' + (parseErr instanceof Error ? parseErr.message : 'خطأ غير معروف'),
        response.status,
        url
      )
    }

    // Check for API-level errors
    if (!response.ok || data?.error) {
      throw new ApiError(
        data?.error || `فشل الطلب (${response.status})`,
        response.status,
        url
      )
    }

    return { data, status: response.status }
  } catch (err) {
    if (err instanceof ApiError) {
      throw err
    }
    // Network error
    throw new ApiError(
      'خطأ في الاتصال بالسيرفر: ' + (err instanceof Error ? err.message : 'غير معروف'),
      0,
      url
    )
  }
}

export { ApiError, apiFetch }
