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
