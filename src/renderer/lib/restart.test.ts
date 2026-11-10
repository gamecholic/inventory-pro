import { beforeEach, describe, expect, it, vi } from 'vitest'
import { restartForUpdate } from './restart'
import { useRestartStore } from '@/stores/restart'

/**
 * The restart watch decides when the browser tab may reload. Getting that
 * wrong means either a frozen tab (never reloads) or a reload into a dead
 * server ("site can't be reached").
 */

const OLD_HEALTH = { ok: true, version: '1.3.10', pid: 111 }
const NEW_HEALTH = { ok: true, version: '1.3.11', pid: 222 }

function healthResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response
}

/** Serve `steps` in order; the last one repeats. `Error` means "offline". */
function fetchSequence(steps: Array<Response | Error>): ReturnType<typeof vi.fn> {
  const queue = [...steps]
  return vi.fn(async () => {
    const next = queue.length > 1 ? queue.shift()! : queue[0]
    if (next instanceof Error) throw next
    return next
  })
}

let install: ReturnType<typeof vi.fn>
let reload: ReturnType<typeof vi.fn>

beforeEach(() => {
  install = vi.fn().mockResolvedValue(true)
  reload = vi.fn()
  vi.stubGlobal('window', { api: { updater: { install } }, location: { reload } })
  useRestartStore.getState().end()
})

describe('restart watch', () => {
  it('reloads the tab once a new instance answers', async () => {
    vi.stubGlobal(
      'fetch',
      fetchSequence([
        healthResponse(OLD_HEALTH), // baseline: the instance asking for the update
        new Error('offline'), // the installer stopped the server
        new Error('offline'), // ... confirmed down
        healthResponse(NEW_HEALTH) // the new instance is serving
      ])
    )

    await restartForUpdate('1.3.11')

    expect(reload).toHaveBeenCalledTimes(1)
    expect(useRestartStore.getState().phase).toBe('ready')
  })

  it('does not reload while the old instance is still serving', async () => {
    vi.stubGlobal('fetch', fetchSequence([healthResponse(OLD_HEALTH)]))

    const running = restartForUpdate('1.3.11')
    await new Promise((resolve) => setTimeout(resolve, 1200))

    expect(reload).not.toHaveBeenCalled()
    expect(useRestartStore.getState().phase).toBe('installing')

    useRestartStore.getState().end()
    await running
  })

  it('reports a failed install instead of waiting for a server that stays up', async () => {
    install.mockResolvedValue(false)
    vi.stubGlobal('fetch', fetchSequence([healthResponse(OLD_HEALTH)]))

    await restartForUpdate('1.3.11')

    expect(reload).not.toHaveBeenCalled()
    expect(useRestartStore.getState().error).toBeTruthy()
  })

  it('keeps waiting when the install answer never arrives', async () => {
    // The server exits before it can answer: that is the normal path.
    install.mockRejectedValue(new Error('network error'))
    vi.stubGlobal(
      'fetch',
      fetchSequence([
        healthResponse(OLD_HEALTH),
        new Error('offline'),
        new Error('offline'),
        healthResponse(NEW_HEALTH)
      ])
    )

    await restartForUpdate('1.3.11')

    expect(reload).toHaveBeenCalledTimes(1)
    expect(useRestartStore.getState().error).toBeNull()
  })
})
