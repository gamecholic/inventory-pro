import { create } from 'zustand'

/**
 * Where the app is in the restart sequence.
 *
 * The update install replaces the running exe, so the server dies while the
 * browser tab stays open. The overlay keeps the user informed and a
 * background watch reloads the tab once the new server answers.
 */
export type RestartPhase = 'preparing' | 'installing' | 'starting' | 'ready'

interface RestartState {
  /** True while the overlay is shown. */
  active: boolean
  phase: RestartPhase
  /** Version being installed, when the restart comes from an update. */
  version: string | null
  /** Epoch ms when the restart started — drives the elapsed counter. */
  startedAt: number
  /** Set when the restart gave up (the new server never answered). */
  error: string | null
  begin: (phase: RestartPhase, version?: string | null) => void
  setPhase: (phase: RestartPhase) => void
  fail: (message: string) => void
  end: () => void
}

export const useRestartStore = create<RestartState>()((set) => ({
  active: false,
  phase: 'preparing',
  version: null,
  startedAt: 0,
  error: null,
  begin: (phase, version = null) =>
    set({ active: true, phase, version, startedAt: Date.now(), error: null }),
  setPhase: (phase) => set({ phase }),
  fail: (message) => set({ error: message }),
  end: () =>
    set({ active: false, phase: 'preparing', version: null, startedAt: 0, error: null })
}))
