import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { restartForUpdate } from './restart'
import { useRestartStore } from '@/stores/restart'

/**
 * The restart watch decides when the browser tab may reload. Getting that
 * wrong means either a frozen tab (never reloads) or a reload into a dead
 * server ("site can't be reached").
 *
 * This file runs under both suites (`npm run test` and `npm run test:bun`),
 * so it avoids runner-specific helpers: no `vi`, no `bun:test` — globals are
 * assigned directly and the mocks are plain functions.
 */

const OLD_HEALTH = { ok: true, version: '1.3.10', pid: 111 }
const NEW_HEALTH = { ok: true, version: '1.3.11', pid: 222 }

function healthResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

/** Records the calls and answers with `impl`. */
function recorder<T>(impl: (...args: unknown[]) => T): {
  fn: (...args: unknown[]) => T
  calls: unknown[][]
} {
  const calls: unknown[][] = []
  return {
    calls,
    fn: (...args: unknown[]): T => {
      calls.push(args)
      return impl(...args)
    }
  }
}

/** Serve `steps` in order; the last one repeats. `Error` means "offline". */
function fetchSequence(steps: Array<Response | Error>): () => Promise<Response> {
  const queue = [...steps]
  return async (): Promise<Response> => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]
    if (next instanceof Error) throw next
    return next
  }
}

const globals = globalThis as unknown as { window?: unknown; fetch?: unknown }
let originalWindow: unknown
let originalFetch: unknown

beforeEach(() => {
  originalWindow = globals.window
  originalFetch = globals.fetch
  useRestartStore.getState().end()
})

afterEach(() => {
  globals.window = originalWindow
  globals.fetch = originalFetch
})

/** Fake the browser globals the controller uses (window.api, location, fetch). */
function stubBrowser(options: {
  install: unknown
  reload: () => void
  fetch: () => Promise<Response>
}): void {
  globals.window = {
    api: { updater: { install: options.install } },
    location: { reload: options.reload }
  }
  globals.fetch = options.fetch
}

describe('restart watch', () => {
  it('reloads the tab once a new instance answers', async () => {
    const install = recorder(() => Promise.resolve(true))
    const reload = recorder(() => undefined)
    stubBrowser({
      install: install.fn,
      reload: reload.fn,
      fetch: fetchSequence([
        healthResponse(OLD_HEALTH), // baseline: the instance asking for the update
        new Error('offline'), // the installer stopped the server
        new Error('offline'), // ... confirmed down
        healthResponse(NEW_HEALTH) // the new instance is serving
      ])
    })

    await restartForUpdate('1.3.11')

    expect(reload.calls.length).toBe(1)
    expect(useRestartStore.getState().phase).toBe('ready')
  })

  it('does not reload while the old instance is still serving', async () => {
    const install = recorder(() => Promise.resolve(true))
    const reload = recorder(() => undefined)
    stubBrowser({
      install: install.fn,
      reload: reload.fn,
      fetch: fetchSequence([healthResponse(OLD_HEALTH)])
    })

    const running = restartForUpdate('1.3.11')
    await new Promise((resolve) => setTimeout(resolve, 1200))

    expect(reload.calls.length).toBe(0)
    expect(useRestartStore.getState().phase).toBe('installing')

    useRestartStore.getState().end()
    await running
  })

  it('reports a failed install instead of waiting for a server that stays up', async () => {
    const install = recorder(() => Promise.resolve(false))
    const reload = recorder(() => undefined)
    stubBrowser({
      install: install.fn,
      reload: reload.fn,
      fetch: fetchSequence([healthResponse(OLD_HEALTH)])
    })

    await restartForUpdate('1.3.11')

    expect(reload.calls.length).toBe(0)
    expect(useRestartStore.getState().error).toBeTruthy()
  })

  it('keeps waiting when the install answer never arrives', async () => {
    // The server exits before it can answer: that is the normal path.
    const install = recorder(() => Promise.reject(new Error('network error')))
    const reload = recorder(() => undefined)
    stubBrowser({
      install: install.fn,
      reload: reload.fn,
      fetch: fetchSequence([
        healthResponse(OLD_HEALTH),
        new Error('offline'),
        new Error('offline'),
        healthResponse(NEW_HEALTH)
      ])
    })

    await restartForUpdate('1.3.11')

    expect(reload.calls.length).toBe(1)
    expect(useRestartStore.getState().error).toBeNull()
  })
})
