import { useQuery } from '@tanstack/react-query'

export const backupDirKey = ['backup-dir'] as const

/** Effective scheduled-backup folder (custom setting or app default). Shown when the schedule is on. */
export function useBackupDir() {
  return useQuery({ queryKey: backupDirKey, queryFn: () => window.api.backup.dir(), staleTime: 30_000 })
}
