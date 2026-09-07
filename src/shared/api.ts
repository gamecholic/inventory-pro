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
  'backup:import-legacy-excel',
  'updater:check',
  'updater:download',
  'updater:progress',
  'updater:install',
  'db:reset',
  'products:list',
  'products:create',
  'products:update',
  'products:archive',
  'products:restore',
  'categories:list',
  'categories:create',
  'categories:update',
  'categories:delete',
  'suppliers:list',
  'suppliers:create',
  'suppliers:update',
  'suppliers:delete',
  'products:search',
  'stock:adjust',
  'stock:history',
  'sales:complete',
  'sales:list',
  'sales:get',
  'sales:cancel',
  'expenses:list',
  'expenses:create',
  'expenses:update',
  'expenses:delete',
  'expense-categories:list',
  'expense-categories:create',
  'expense-categories:update',
  'expense-categories:delete',
  'analytics:financial',
  'analytics:top-products',
  'analytics:supplier',
  'analytics:payment',
  'analytics:card-fees',
  'analytics:category',
  'analytics:expenses',
  'analytics:reorder',
  'analytics:dead-stock',
  'analytics:basket',
  'analytics:discounts',
  'analytics:monthly-expenses',
  'analytics:inventory-overview',
  'analytics:inventory-value',
  'analytics:revenue-trend',
  'analytics:weekday',
  'analytics:monthly'
] as const
export type Channel = (typeof channels)[number]

export const idInput = z.object({ id: z.number().int().positive() })
