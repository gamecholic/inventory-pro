import i18n from '@/i18n'
import { useRestartStore } from '@/stores/restart'

/**
 * Restart flows.
 *
 * An update install replaces the running exe; a settings restart (Network /
 * database folder) just stops and starts the local server. Either way the
 * server goes away while the browser tab stays open: the page itself keeps
 * running (only API calls fail), so the tab can show what is happening
 * instead of freezing on a dead server.
 *
 * Both flows:
 *   1. ask the server to switch over (install / restart),
 *   2. a background watch polls /api/health until the server is really gone
 *      and a new instance answers,
 *   3. the tab reloads itself against the new instance.
 *
 * The new instance comes back on the same port and does not open a second
 * tab (INVENTORY_RELAUNCH in server/boot.ts), so the user keeps one tab.
 */

/** /api/health payload (server/index.ts). */
export interface ServerHealth {
  ok: boolean
  version: string
  pid: number
}

/** How often the background watch asks the server whether it is alive. */
const POLL_MS = 500
/** Two failed probes in a row: the server is really down, not hiccuping. */
const DOWN_STREAK_TO_CONFIRM = 2
/** Give up after this long — a slow disk can make the installer crawl. */
const WATCH_TIMEOUT_MS = 180_000
/** A plain server restart is much quicker than installing an update. */
const SERVER_RESTART_TIMEOUT_MS = 30_000
/** How long the "ready" state stays on screen before the tab reloads. */
const RELOAD_DELAY_MS = 700

/** Set when the overlay is dismissed — the watch stops watching. */
let stopRequested = false

// Dismissing the overlay (store.end()) cancels the watch: nothing should
// reload the tab behind the user's back afterwards.
useRestartStore.subscribe((state, prev) => {
  if (prev.active && !state.active) stopRequested = true
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Ask the local server whether it is alive. Returns null while it is down
 * (the browser reports a network error — the normal state during a
 * restart).
 */
export async function probeHealth(): Promise<ServerHealth | null> {
  try {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500)
    })
    if (!response.ok) return null
    return (await response.json()) as ServerHealth
  } catch {
    return null
  }
}

/**
 * Install the staged update and wait for the new server to come back.
 * The overlay stays up the whole time; the tab reloads itself when the
 * new instance answers.
 */
export async function restartForUpdate(version: string | null): Promise<void> {
  stopRequested = false
  useRestartStore.getState().begin('update', 'preparing', version)

  // Remember the running instance so the watch can tell it apart from the
  // one the installer starts.
  const baseline = await probeHealth()

  // The install answer arrives before the server exits, but the exit can
  // cut the response short — a rejected call then means "the server is
  // gone", not "the install failed". Only an explicit `false` is a failure.
  let installFailed = false
  void window.api.updater.install().then(
    (ok) => {
      if (ok === false) installFailed = true
    },
    () => {
      // No answer: the server died mid-response. Keep waiting for the new
      // instance — the watch below decides whether the install happened.
    }
  )

  useRestartStore.getState().setPhase('installing')
  await waitForNewInstance(baseline, () => installFailed)
}

/**
 * Restart the local server for a setting that is only read at boot (Network
 * access, database folder) and wait for it to come back. Same overlay and
 * same in-place reload as an update — no dead tab, no second tab, no
 * blind `setTimeout(location.reload)`.
 */
export async function restartServer(): Promise<void> {
  stopRequested = false
  useRestartStore.getState().begin('server', 'preparing')

  const baseline = await probeHealth()

  // The server answers before it exits, so a rejection here usually means
  // "it went down first" — keep watching. Only `restarting: false` (could not
  // spawn the successor) is a real failure.
  let restartFailed = false
  void window.api.restart().then(
    (result) => {
      if (result?.restarting === false) restartFailed = true
    },
    () => {
      // No answer: the server exited mid-response, which is expected.
    }
  )

  useRestartStore.getState().setPhase('installing')
  await waitForNewInstance(baseline, () => restartFailed, {
    timeoutMs: SERVER_RESTART_TIMEOUT_MS,
    failure: i18n.t('updates.serverRestartFailed'),
    timeout: i18n.t('updates.serverRestartTimeout')
  })
}

/**
 * Poll the server until a *different* instance answers, then reload the
 * tab. A server that stays up and never changes means the switch did not
 * happen; one that never comes back means it failed.
 */
async function waitForNewInstance(
  baseline: ServerHealth | null,
  isFailed: () => boolean,
  messages?: { timeoutMs?: number; failure?: string; timeout?: string }
): Promise<void> {
  const deadline = Date.now() + (messages?.timeoutMs ?? WATCH_TIMEOUT_MS)
  let sawDown = false
  let downStreak = 0

  while (Date.now() < deadline) {
    await sleep(POLL_MS)

    if (stopRequested) return

    if (isFailed()) {
      useRestartStore.getState().fail(messages?.failure ?? i18n.t('updates.restartFailed'))
      return
    }

    const health = await probeHealth()
    if (!health) {
      downStreak += 1
      if (!sawDown && downStreak >= DOWN_STREAK_TO_CONFIRM) {
        sawDown = true
        useRestartStore.getState().setPhase('starting')
      }
      continue
    }
    downStreak = 0

    // The old instance is still up (same pid, same version) — nothing to do
    // yet. A different pid/version, or a server that was really down a
    // moment ago, means the new instance is serving.
    const changed =
      baseline !== null &&
      (health.pid !== baseline.pid || health.version !== baseline.version)
    if (!changed && !sawDown) continue

    useRestartStore.getState().setPhase('ready')
    await sleep(RELOAD_DELAY_MS)
    window.location.reload()
    return
  }

  useRestartStore.getState().fail(messages?.timeout ?? i18n.t('updates.restartTimeout'))
}
