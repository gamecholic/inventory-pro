const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u'
}

/**
 * Turkish-tolerant normalization for every product search path
 * (features §1.2, §3.1, §4.3, §5.1). Apply to both query and target.
 */
export function normalizeTR(input: string): string {
  return input
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/[çğıöşü]/g, (ch) => TR_MAP[ch] ?? ch)
}
