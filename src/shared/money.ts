export type StoreCurrency = 'USD' | 'EUR' | 'GBP' | 'TRY'

/** Money with 2 decimals in the store currency (features §1.3). */
export function formatMoney(amount: number, currency: StoreCurrency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Round to cents. Applied at every save boundary (product prices, stock cost
 * averaging) so repeating decimals like 71.666… never reach the DB or inputs.
 * Matches the spec's "2-decimal steps" for all price fields.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
