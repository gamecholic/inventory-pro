import { z } from 'zod'

/** ISO8601 UTC datetime on the wire — never local formats, never epoch-ms. */
export const isoDateTime = z.string().datetime({ offset: true })

/** Shared range filter for dashboard charts, sales history, expenses, reports. */
export const dateRangeFilter = z.object({
  from: isoDateTime,
  to: isoDateTime
})

export type DateRangeFilter = z.infer<typeof dateRangeFilter>

export const channels = [
  'app:ping',
  'settings:get',
  'settings:update',
  'backup:export-json',
  'backup:import-json',
  'backup:export-excel',
  'backup:import-excel',
  'db:reset'
] as const
export type Channel = (typeof channels)[number]
