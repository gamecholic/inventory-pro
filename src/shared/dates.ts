import { endOfDay, format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subYears } from 'date-fns'

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

/** ISO8601 → store date + 24h time (sales list §6.1, reprint §6.4). */
export function formatDateTime(iso: string, fmt: StoreDateFormat): string {
  const d = fromISO(iso)
  return `${format(d, FNS_FORMAT[fmt])} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Draft {from,to} Dates → applied ISO day bounds (§6.2, §7.4, §8). */
export function dayBounds(range: { from: Date; to: Date }): { from: string; to: string } {
  return { from: toISO(startOfDay(range.from)), to: toISO(endOfDay(range.to)) }
}

/** Start of today (local) as ISO — for default filter ranges like "last 30 days". */
export function todayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export type DatePreset =
  | 'today'
  | 'week'
  | 'month'
  | 'year'
  | 'lastMonth'
  | 'lastYear'
  | 'last5Years'

/** Quick ranges for the sales date filter. Week starts Monday. End is always now. */
export function presetRange(preset: DatePreset, now: Date = new Date()): { from: Date; to: Date } {
  const to = now
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to }
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to }
    case 'month':
      return { from: startOfMonth(now), to }
    case 'year':
      return { from: startOfYear(now), to }
    case 'lastMonth':
      return { from: startOfDay(subDays(now, 30)), to }
    case 'lastYear':
      return { from: startOfDay(subYears(now, 1)), to }
    case 'last5Years':
      return { from: startOfDay(subYears(now, 5)), to }
  }
}
