import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatMoney, round2 } from '@shared/money'
import { marginPct, priceForMargin, type AdjustmentPreview } from '@shared/stock'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import { useSettings } from '@/hooks/useSettings'
import { PriceHistoryChart } from './PriceHistoryChart'

const fmtPct = (v: number | null): string => (v === null ? '—' : `${v.toFixed(1)}%`)

/**
 * Features §5.3 — the answer, not a preview table. One average cost, one arrow,
 * three lines, and the price trail with this purchase drawn as a projection.
 */
export function CostAnswer({
  product,
  preview,
  selling,
  onSellingChange
}: {
  product: ProductRow
  preview: AdjustmentPreview | null
  selling: number
  onSellingChange: (price: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const currency = settings?.general.currency ?? 'USD'
  const unit = unitShort(product.unit, t)
  const [editing, setEditing] = useState(false)

  const newCost = preview ? round2(preview.newCost) : product.costPrice
  const delta = round2(newCost - product.costPrice)
  const deltaPct = product.costPrice > 0 ? (delta / product.costPrice) * 100 : null
  const oldMargin = marginPct(product.sellingPrice, product.costPrice)
  const newMargin = marginPct(selling, newCost)
  const keepPrice = priceForMargin(newCost, oldMargin)
  const isLoss = selling > 0 && newCost > selling

  const stockText = preview
    ? `${preview.currentQty} → ${preview.newQty} ${unit}`
    : `${product.stockQty} ${unit}`
  const valueText = preview
    ? `${formatMoney(preview.currentValue, currency)} → ${formatMoney(preview.newValue, currency)}`
    : formatMoney(product.stockQty * product.costPrice, currency)

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('stock.newAverageCost')}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatMoney(newCost, currency)}
          </span>
          {delta === 0 ? (
            <span className="text-xs text-muted-foreground">{t('stock.unchanged')}</span>
          ) : (
            <Badge variant="secondary" className="tabular-nums">
              {delta > 0 ? '+' : '−'}
              {formatMoney(Math.abs(delta), currency)}
              {deltaPct !== null && ` · ${delta > 0 ? '+' : '−'}${Math.abs(deltaPct).toFixed(1)}%`}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {t('stock.wasCost', { money: formatMoney(product.costPrice, currency), unit })}
        </p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
          <span className="text-muted-foreground">{t('stock.stockQty')}</span>
          <span className="text-right tabular-nums">{stockText}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
          <span className="text-muted-foreground">{t('stock.stockValue')}</span>
          <span className="text-right tabular-nums">{valueText}</span>
        </div>
        <div className="flex items-center justify-between gap-2 py-1 text-sm">
          <span className="text-muted-foreground">{t('stock.sellingPrice')}</span>
          {editing ? (
            <Input
              autoFocus
              aria-label={t('stock.sellingPrice')}
              type="number"
              min={0}
              step={0.01}
              className="h-8 w-28 text-right tabular-nums"
              value={selling}
              onChange={(e) => onSellingChange(Number(e.target.value))}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setEditing(false)
                }
              }}
            />
          ) : (
            <span className="flex items-center gap-1">
              <span className="tabular-nums">{formatMoney(selling, currency)}</span>
              <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>
                {t('stock.edit')}
              </Button>
            </span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2 py-1 text-sm">
          <span className="text-muted-foreground">{t('stock.margin')}</span>
          <span className="text-right tabular-nums">
            {fmtPct(oldMargin)} → <strong>{fmtPct(newMargin)}</strong>
          </span>
        </div>
      </div>

      {isLoss && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
          {t('stock.lossWarning')}
        </p>
      )}

      {keepPrice !== null && oldMargin !== null && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-auto w-full justify-start py-2 text-left leading-snug whitespace-normal"
          onClick={() => {
            onSellingChange(round2(keepPrice))
            setEditing(false)
          }}
        >
          {t('stock.keepMargin', {
            pct: oldMargin.toFixed(1),
            money: formatMoney(round2(keepPrice), currency)
          })}
        </Button>
      )}

      <Separator />
      <PriceHistoryChart
        productId={product.id}
        projected={preview ? { cost: newCost, selling } : null}
      />
    </div>
  )
}
