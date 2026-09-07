import { useQuery } from '@tanstack/react-query'

export const appVersionKey = ['app-version'] as const

/** Packaged app version (package.json via main). Display-only, shown in Settings. */
export function useAppVersion() {
  return useQuery({ queryKey: appVersionKey, queryFn: () => window.api.version(), staleTime: Infinity })
}
