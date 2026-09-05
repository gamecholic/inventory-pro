/** Units from features §3.2/§4.1. Short label is stored; long label for display. */
export const UNITS = [
  { value: 'pcs', long: 'Pieces' },
  { value: 'kg', long: 'Kilograms' },
  { value: 'g', long: 'Grams' },
  { value: 'l', long: 'Liters' },
  { value: 'ml', long: 'Milliliters' },
  { value: 'm', long: 'Meters' },
  { value: 'box', long: 'Boxes' },
  { value: 'unit', long: 'Units' }
] as const

export type Unit = (typeof UNITS)[number]['value']
export const UNIT_VALUES = UNITS.map((u) => u.value) as unknown as [Unit, ...Unit[]]

export function unitLong(value: string): string {
  return UNITS.find((u) => u.value === value)?.long ?? value
}
