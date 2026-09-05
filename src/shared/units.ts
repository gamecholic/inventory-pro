/** Canonical unit codes stored in the DB (features §3.2/§4.1). Display labels are translated — see i18n `units.*`. */
export const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'm', 'box', 'unit'] as const

export type Unit = (typeof UNITS)[number]
export const UNIT_VALUES = UNITS as unknown as [Unit, ...Unit[]]

type TFunction = (key: string) => string

const label = (t: TFunction, value: string, suffix: '' | 'Long'): string => {
  const key = `units.${value}${suffix}`
  const translated = t(key)
  return translated === key ? value : translated
}

/** Short label for tables, stock badges, receipts (`3 adet`, `12 pcs`). Falls back to the code. */
export function unitShort(value: string, t: TFunction): string {
  return label(t, value, '')
}

/** Long label for dropdowns and explanations. Falls back to the code. */
export function unitLong(value: string, t: TFunction): string {
  return label(t, value, 'Long')
}
