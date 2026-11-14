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
  /** 0–100 download percent reported by server/updater.ts. */
  percent: z.number().min(0).max(100)
})
export type UpdaterProgress = z.infer<typeof updaterProgress>

/**
 * Find one file's SHA-256 in a `sha256sum` listing — the format the release
 * workflow publishes as `checksums.txt` and `server/updater.ts` verifies before
 * executing an installer. Accepts GNU `<hash>  <name>`, the `*binary` marker,
 * paths in the name column, and CRLF line endings.
 */
export function parseChecksum(listing: string, fileName: string): string | null {
  const target = fileName.toLowerCase()
  for (const line of listing.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim())
    if (!match) continue
    const name = match[2].trim().split(/[\\/]/).pop()?.toLowerCase() ?? ''
    if (name === target) return match[1].toLowerCase()
  }
  return null
}
