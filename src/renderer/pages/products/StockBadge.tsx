import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { stockStatus } from '@shared/products'
import { unitShort } from '@shared/units'

/** `<qty> <unit> (<status>)` — red out, amber low, green in (features §4.3). */
export function StockBadge({
  qty,
  unit,
  threshold
}: {
  qty: number
  unit: string
  threshold: number
}): React.JSX.Element {
  const { t } = useTranslation()
  const level = stockStatus(qty, threshold)
  const variant = level === 'out' ? 'destructive' : level === 'low' ? 'secondary' : 'default'
  const label = level === 'out' ? t('products.outOfStock') : level === 'low' ? t('products.lowStock') : t('products.inStock')
  return (
    <span className="flex items-center gap-2">
      <span>
        {qty} {unitShort(unit, t)}
      </span>
      <Badge variant={variant}>{label}</Badge>
    </span>
  )
}
