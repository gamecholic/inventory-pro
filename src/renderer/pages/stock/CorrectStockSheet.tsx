import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { formatMoney } from '@shared/money'
import { computeAdjustment } from '@shared/stock'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import { useAdjustStock } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

/**
 * Features §5.5 — the rare path: stock is wrong (damage, recount, a return).
 * Out of the main flow so "Add" never has to share a tab with "Remove".
 */
export function CorrectStockSheet({
  product,
  open,
  onOpenChange,
  onUpdated
}: {
  product: ProductRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (product: ProductRow) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const adjust = useAdjustStock()
  const currency = settings?.general.currency ?? 'USD'
  const unit = unitShort(product.unit, t)
  const [qtyText, setQtyText] = useState('1')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setQtyText('1')
      setReason('')
    }
  }, [open])

  const qty = Math.max(0, Math.round(Number(qtyText) || 0))
  const preview =
    qty >= 1
      ? computeAdjustment(
          { stockQty: product.stockQty, costPrice: product.costPrice },
          { type: 'remove', quantity: qty, newCostPrice: null }
        )
      : null

  const reasonOptions = [t('stock.reasonDamaged'), t('stock.reasonRecount'), t('stock.reasonReturn')]

  const submit = (): void => {
    adjust.mutate(
      {
        productId: product.id,
        type: 'remove',
        quantity: qty,
        newCostPrice: null,
        newSellingPrice: null,
        reason
      },
      {
        onSuccess: (result) => {
          onUpdated(result.product)
          onOpenChange(false)
        }
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0">
        <SheetHeader>
          <SheetTitle>{t('stock.correctTitle', { name: product.name })}</SheetTitle>
          <SheetDescription>{t('stock.removeHint')}</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('stock.currentStock')}: {product.stockQty} {unit}
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correct-qty">{t('stock.removeQty')}</Label>
            <div className="relative">
              <Input
                id="correct-qty"
                type="number"
                min={1}
                step={1}
                className="pr-14 tabular-nums"
                value={qtyText}
                onChange={(e) => setQtyText(e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                {unit}
              </span>
            </div>
            {qty < 1 && <p className="text-xs text-destructive">{t('stock.invalidQty')}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('stock.note')}</Label>
            <div className="flex flex-wrap gap-1">
              {reasonOptions.map((label) => (
                <Button
                  key={label}
                  type="button"
                  variant={reason === label ? 'secondary' : 'outline'}
                  size="xs"
                  onClick={() => setReason(reason === label ? '' : label)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Input
              aria-label={t('stock.note')}
              placeholder={t('stock.notePlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {preview && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{t('stock.removeConfirm')}</p>
              <p className="text-muted-foreground tabular-nums">
                {preview.currentQty} {unit} − {qty} {unit} →{' '}
                <strong className="text-foreground">
                  {preview.newQty} {unit}
                </strong>
              </p>
              <p className="text-muted-foreground tabular-nums">
                {formatMoney(preview.currentValue, currency)} → {formatMoney(preview.newValue, currency)}
              </p>
            </div>
          )}

          <SheetFooter className="mt-auto px-0">
            <Button type="submit" variant="destructive" disabled={qty < 1 || adjust.isPending}>
              {adjust.isPending ? t('stock.saving') : t('stock.removeConfirm')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('stock.cancel')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
