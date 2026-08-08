// Service Worker - يعمل offline 100%
// الإصدار: يُرفع عند كل تغيير لاستراتيجية الكاش لضمان استبدال القديم
const CACHE_NAME = 'factory-app-v6'
// حد أقصى لعناصر الكاش (تنظيف LRU بسيط لمنع تضخم مساحة التخزين)
const CACHE_LIMIT = 80
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

// تنظيف LRU: حذف أقدم العناصر عند تجاوز الحد
async function trimCache(cache) {
  try {
    const keys = await cache.keys()
    if (keys.length <= CACHE_LIMIT) return
    const excess = keys.length - CACHE_LIMIT
    // cache.keys() ترجع العناصر بترتيب الإضافة — نحذف الأقدم
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i])
    }
  } catch (e) {
    console.warn('[SW] cache trim failed:', e)
  }
}

// تخزين في الكاش مع تنظيف تلقائي
async function cachePut(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response)
    await trimCache(cache)
  } catch (e) {
    console.warn('[SW] cache put failed:', e)
  }
}

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // نخزن كل أصل على حدة حتى لا يُسقط فشل أصل واحد الباقي، مع تسجيل الخطأ
      return Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((e) => {
            console.warn('[SW] failed to cache asset during install:', asset, e)
          })
        )
      )
    })
  )
})

// تفعيل Service Worker - حذف الكاش القديم فوراً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      })
      .catch((e) => console.warn('[SW] activate cleanup failed:', e))
  )
  self.clients.claim()
})

// استراتيجية: Network First للكل شيء ما عدا الملفات الثابتة
// هذا يضمن تحميل أحدث نسخة من التطبيق بعد كل نشر (لا قديمة من الكاش)
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // تجاهل الطلبات non-GET
  if (request.method !== 'GET') return

  // تجاهل طلبات الـ API (دائماً من الشبكة لو متاح)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // للملفات الثابتة: Network First مع fallback للكاش
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            cachePut(request, response.clone())
          }
          return response
        })
        .catch(() => {
          // فقط لو الشبكة فاشلة، نستخدم الكاش
          return caches.match(request).then((cached) => {
            return cached || new Response('Offline', { status: 503 })
          })
        })
    )
    return
  }

  // للصفحات (HTML): Network First مع fallback للـ cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            cachePut(request, response.clone())
          }
          return response
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/')
          })
        })
    )
  }
})
