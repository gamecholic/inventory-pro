/*
 * Inventory Pro service worker.
 *
 * The app is a Bun server on this PC and its data is live, so this worker
 * never caches /api/* responses. It only keeps the built app shell and the
 * hashed assets, which makes the installed window open (with normal loading /
 * error states) while the server is restarting or momentarily down.
 *
 * vite.web.config.ts copies this file to web/sw.js and bakes the package
 * version in as the cache id, so each release installs a fresh cache and drops
 * the previous one. Navigation is network-first, so rebuilding the renderer
 * without a version bump still picks up the new hashed assets.
 */
const BUILD_ID = '__BUILD_ID__'
const CACHE_PREFIX = 'inventory-pro-'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${BUILD_ID}`
const ASSET_CACHE = `${CACHE_PREFIX}assets-${BUILD_ID}`

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

/** Fresh shell when the server answers; cached shell when it does not. */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch {
    const cached = await caches.match('/index.html')
    return cached ?? new Response('Inventory Pro server is not reachable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    })
  }
}

/** Build assets are content-hashed and immutable, so a hit never goes stale. */
async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE)
    await cache.put(request, response.clone())
  }
  return response
}

/** Icons/manifest and anything else: show cache immediately, refresh behind it. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(ASSET_CACHE)
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)
  return cached ?? (await network) ?? Response.error()
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Shop data is live and must never be served from a cache.
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request))
    return
  }
  event.respondWith(staleWhileRevalidate(request))
})
