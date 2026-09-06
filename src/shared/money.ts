export type StoreCurrency = 'USD' | 'EUR' | 'GBP' | 'TRY'

/** Exact symbols from the spec (features §1.3). Intl maps these inconsistently per locale, so pin them. */
export const CURRENCY_SYMBOLS: Record<StoreCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  TRY: '₺'
}

/** Money with 2 decimals and the pinned store-currency symbol (features §1.3). */
export function formatMoney(amount: number, currency: StoreCurrency): string {
  const grouped = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
  return `${CURRENCY_SYMBOLS[currency]}${grouped}`
}

/**
 * Round to cents. Applied at every save boundary (product prices, stock cost
 * averaging) so repeating decimals like 71.666… never reach the DB or inputs.
 * Matches the spec's "2-decimal steps" for all price fields.
 */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Shared Recharts tooltip value formatter (money). One definition for all chart panels. */
export function chartMoneyFormatter(currency: StoreCurrency): (value: unknown) => string {
  return (value: unknown) => formatMoney(Number(value), currency)
}
