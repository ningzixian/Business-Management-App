const CACHE_NAME = 'department-steward-static-v2'
const APP_SHELL = ['/', '/manifest.webmanifest', '/app-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('department-steward-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Never cache authenticated APIs, downloads, update metadata, or unknown routes.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      !(APP_SHELL.includes(url.pathname) || url.pathname.startsWith('/assets/'))) return
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((response) => response || (event.request.mode === 'navigate' ? caches.match('/') : Response.error()))),
  )
})
