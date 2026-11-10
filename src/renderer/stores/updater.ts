import { create } from 'zustand'

interface UpdaterState {
  /** True while the installer is being downloaded (server-side progress). */
  downloading: boolean
  /** 0–100 download progress, polled from the server. */
  percent: number
  setDownloading: (downloading: boolean) => void
  setPercent: (percent: number) => void
}

/**
 * Ephemeral download state shared by the update card and Settings > About,
 * so both show the same progress whichever one started the download.
 */
export const useUpdaterStore = create<UpdaterState>()((set) => ({
  downloading: false,
  percent: 0,
  setDownloading: (downloading) => set({ downloading }),
  setPercent: (percent) => set({ percent })
}))
