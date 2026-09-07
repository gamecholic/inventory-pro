import { useQuery } from '@tanstack/react-query'

export const backupDirKey = ['backup-dir'] as const

/** Effective close-backup folder (custom setting or app default). Shown when backup-on-close is on. */
export function useBackupDir() {
  return useQuery({ queryKey: backupDirKey, queryFn: () => window.api.backup.dir(), staleTime: 30_000 })
}
