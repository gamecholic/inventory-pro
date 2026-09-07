import { useQuery } from '@tanstack/react-query'
import type { UpdaterCheck } from '@shared/updater'

export const updaterKey = ['updater'] as const

/** Check GitHub Releases once on launch (features §1.6). Silent unless an update is available. */
export function useUpdaterCheck() {
  return useQuery<UpdaterCheck>({
    queryKey: updaterKey,
    queryFn: () => window.api.updater.check(),
    staleTime: Infinity,
    retry: false
  })
}
