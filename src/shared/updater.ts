import { z } from 'zod'

/** Update lifecycle surfaced to the renderer (features §1.6). */
export const updaterStatus = z.enum(['up-to-date', 'available', 'downloading', 'downloaded', 'error'])
export type UpdaterStatus = z.infer<typeof updaterStatus>

export const updaterCheck = z.object({
  status: updaterStatus,
  /** New version, present when status is available/downloading/downloaded. */
  version: z.string().optional(),
  /** Human-readable reason, present when status is error. */
  message: z.string().optional()
})
export type UpdaterCheck = z.infer<typeof updaterCheck>

export const updaterProgress = z.object({
  /** 0–100 download percent reported by electron-updater. */
  percent: z.number().min(0).max(100)
})
export type UpdaterProgress = z.infer<typeof updaterProgress>
