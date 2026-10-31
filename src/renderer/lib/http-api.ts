import { createApi, type Invoke } from '@shared/api-surface'

/**
 * Browser transport. Installs `window.api` over HTTP so every renderer call
 * site (window.api.sales.list, window.api.analytics.financial, ...) keeps
 * working unchanged. Loaded before React mounts; a no-op under Electron,
 * where preload already exposed the IPC-backed API.
 *
 * File channels need nothing special here: the server raises the native
 * Windows dialog itself and returns an absolute path (server/dialogs.ts), the
 * same contract Electron's dialog module provided.
 */

const BASE = '/api'

async function post(channel: string, payload?: unknown): Promise<unknown> {
  const response = await fetch(`${BASE}/${encodeURIComponent(channel)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ payload })
  })
  if (!response.ok) {
    // Server returns a plain-text message; the UI shows thrown messages as-is.
    throw new Error((await response.text()) || `Request failed: ${response.status}`)
  }
  return response.json()
}

const invoke: Invoke = async <T>(channel: string, payload?: unknown): Promise<T> =>
  (await post(channel, payload)) as T

if (!window.api) {
  window.api = createApi(invoke)
}
