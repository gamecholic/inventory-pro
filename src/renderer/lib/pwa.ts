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

/**
 * Safari on iPhone/iPad is the only browser that can add this app to the Home
 * Screen without an install prompt. iPadOS reports a desktop Mac UA, so the
 * touch-point check is part of the test.
 */
export function isIosSafari(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  if (!isIos) return false
  // Other iOS browsers put their own token in the UA (CriOS, FxiOS, ...).
  if (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|DuckDuckGo|Brave/.test(userAgent)) return false
  return /Safari\//.test(userAgent)
}

/** The app is already running from the Home Screen / installed window. */
export function isStandalone(displayModeMatches: boolean, navigatorStandalone?: boolean): boolean {
  return displayModeMatches || navigatorStandalone === true
}
