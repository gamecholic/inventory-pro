import { create } from 'zustand'

/**
 * Why the app is restarting: installing an update replaces the exe, while a
 * server restart re-reads settings (Network / DB folder). Both kill the local
 * server for a moment; the overlay wording differs.
 */
export type RestartReason = 'update' | 'server'

/**
 * Where the app is in the restart sequence.
 *
 * The server dies while the browser tab stays open. The overlay keeps the
 * user informed and a background watch reloads the tab once the new server
 * answers.
 */
export type RestartPhase = 'preparing' | 'installing' | 'starting' | 'ready'

interface RestartState {
  /** True while the overlay is shown. */
  active: boolean
  reason: RestartReason
  phase: RestartPhase
  /** Version being installed, when the restart comes from an update. */
  version: string | null
  /** Epoch ms when the restart started — drives the elapsed counter. */
  startedAt: number
  /** Set when the restart gave up (the new server never answered). */
  error: string | null
  begin: (reason: RestartReason, phase: RestartPhase, version?: string | null) => void
  setPhase: (phase: RestartPhase) => void
  fail: (message: string) => void
  end: () => void
}

export const useRestartStore = create<RestartState>()((set) => ({
  active: false,
  reason: 'update',
  phase: 'preparing',
  version: null,
  startedAt: 0,
  error: null,
  begin: (reason, phase, version = null) =>
    set({ active: true, reason, phase, version, startedAt: Date.now(), error: null }),
  setPhase: (phase) => set({ phase }),
  fail: (message) => set({ error: message }),
  end: () =>
    set({ active: false, reason: 'update', phase: 'preparing', version: null, startedAt: 0, error: null })
}))
