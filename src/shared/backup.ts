/** Cloud providers the app can name for a backup folder. `local` means no known cloud root. */
export const backupProviders = ['local', 'google-drive', 'onedrive'] as const
export type BackupProvider = (typeof backupProviders)[number]

/**
 * Sync state of the newest backup file, mirroring the badge Windows Explorer
 * draws on it. `local` is not a cloud folder, `unknown` is a cloud folder whose
 * badge cannot be read (no reference file, provider not running).
 */
export const backupSyncStates = ['local', 'synced', 'pending', 'unknown'] as const
export type BackupSyncState = (typeof backupSyncStates)[number]

/** Why `sync` is not `synced`, so the UI can explain it instead of guessing. */
export type BackupStatusReason = 'no-file' | 'no-cloud' | 'no-reference' | 'no-overlay' | null

export interface BackupStatus {
  folder: string
  provider: BackupProvider
  sync: BackupSyncState
  reason: BackupStatusReason
  fileName: string | null
  filePath: string | null
  sizeBytes: number | null
  /** File mtime, ISO8601 UTC. */
  writtenAt: string | null
  checkedAt: string
}

export interface QuickBackupResult {
  fileName: string
  filePath: string
  sizeBytes: number
  writtenAt: string
}
