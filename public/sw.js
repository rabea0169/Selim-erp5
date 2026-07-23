// Service Worker بسيط للتشغيل offline وتحسين الأداء على الموبايل
const CACHE_NAME = 'factory-app-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// استراتيجية: Network First للـ API، Cache First للـ static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات non-GET
  if (request.method !== 'GET') return;

  // تجاهل طلبات الـ API (دائماً من الشبكة)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // للملفات الثابتة: Cache First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // تحديث في الخلفية
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
        }).catch(() => {});
        return cached;
      }
      // لو مش في cache، جيب من الشبكة
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // لو فشل، رجّع صفحة offline
        if (request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});
