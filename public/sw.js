// Service Worker - يعمل offline 100%
const CACHE_NAME = 'factory-app-v4'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
})

// تفعيل Service Worker - حذف الكاش القديم فوراً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// استراتيجية: Network First للكل شيء ما عدا الملفات الثابتة
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // تجاهل الطلبات non-GET
  if (request.method !== 'GET') return

  // تجاهل طلبات الـ API (دائماً من الشبكة لو متاح)
  if (url.pathname.startsWith('/api/')) {
    return
  }

  // للملفات الثابتة: Network First (وليس Cache First)
  // هذا يضمن دائماً تحميل أحدث الكود بعد كل نشر
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
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
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
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
