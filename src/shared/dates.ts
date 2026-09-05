import { format } from 'date-fns'

export type StoreDateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'

const FNS_FORMAT: Record<StoreDateFormat, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd'
}

/** Date → ISO8601 UTC string for the IPC wire. Call at the edge, never store local formats. */
export function toISO(date: Date): string {
  return date.toISOString()
}

/** ISO8601 string → Date. */
export function fromISO(iso: string): Date {
  return new Date(iso)
}

/** ISO8601 → store display format (renderer only, features §1.3). */
export function formatISO(iso: string, fmt: StoreDateFormat): string {
  return format(fromISO(iso), FNS_FORMAT[fmt])
}

/** Start of today (local) as ISO — for default filter ranges like "last 30 days". */
export function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
