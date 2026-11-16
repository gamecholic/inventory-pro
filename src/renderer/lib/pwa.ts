/**
 * PWA support: registers the built service worker (web/sw.js).
 *
 * Only production builds register: the Vite dev server does not serve sw.js,
 * and a stale shell cache would fight HMR. The worker is also gated on a
 * secure context — http://127.0.0.1 counts, a plain-HTTP LAN address does not
 * (features §1.11), so LAN browsers still get the normal app without an
 * offline shell.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  if (!window.isSecureContext) return

  const register = (): void => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .catch((error: unknown) => {
        // Never break the app because the worker could not be installed.
        console.warn('Service worker registration failed:', error)
      })
  }

  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
