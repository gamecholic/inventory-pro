import { useQuery } from '@tanstack/react-query'

export const dbDirKey = ['db-dir'] as const

/** Database file in use (custom folder or app default). Applies from the next restart. */
export function useDbDir() {
  return useQuery({ queryKey: dbDirKey, queryFn: () => window.api.db.dir(), staleTime: 30_000 })
}
