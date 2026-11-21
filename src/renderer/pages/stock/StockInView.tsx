import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { CURRENCY_SYMBOLS, formatMoney, round2 } from '@shared/money'
import { computeAdjustment, stockAdjustInput, type StockAdjustInput } from '@shared/stock'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import { StockBadge } from '@/components/stock-badge'
import { useAdjustStock } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'
import { CostAnswer } from './CostAnswer'

type AmountMode = 'total' | 'unit'

/**
 * Features §5.2–§5.3 — the purchase form. The owner types a count and the
 * amount the invoice says; the unit cost and the new average are derived. The
 * answer sits beside it and updates as they type.
 */
export function StockInView({
  product,
  onChangeProduct,
  onUpdated
}: {
  product: ProductRow
  onChangeProduct: () => void
  onUpdated: (product: ProductRow) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const adjust = useAdjustStock()
  const currency = settings?.general.currency ?? 'USD'
  const unit = unitShort(product.unit, t)

  // Both money fields keep their raw text so typing decimals never fights a
  // round-trip through a number. `mode` decides which one is authoritative.
  const [mode, setMode] = useState<AmountMode>('total')
  const [amountText, setAmountText] = useState(() => String(round2(product.costPrice)))
  const [unitText, setUnitText] = useState(() => String(round2(product.costPrice)))
  const [noteOpen, setNoteOpen] = useState(false)

  const form = useForm<StockAdjustInput>({
    resolver: zodResolver(stockAdjustInput) as Resolver<StockAdjustInput>,
    defaultValues: {
      productId: product.id,
      type: 'add',
      quantity: 1,
      newCostPrice: product.costPrice,
      newSellingPrice: product.sellingPrice,
      reason: ''
    }
  })

  const qty = form.watch('quantity') ?? 0
  const selling = form.watch('newSellingPrice') ?? product.sellingPrice

  const amountPaid = mode === 'total' ? Number(amountText) || 0 : (Number(unitText) || 0) * qty
  const unitCost = mode === 'total' ? (qty > 0 ? (Number(amountText) || 0) / qty : 0) : Number(unitText) || 0
  const preview =
    qty >= 1
      ? computeAdjustment(
          { stockQty: product.stockQty, costPrice: product.costPrice },
          { type: 'add', quantity: qty, newCostPrice: round2(unitCost) }
        )
      : null

  const toggleMode = (): void => {
    if (mode === 'total') {
      setUnitText(String(round2(unitCost)))
      setMode('unit')
    } else {
      setAmountText(String(round2(amountPaid)))
      setMode('total')
    }
  }

  const submit = form.handleSubmit((values) => {
    adjust.mutate(
      {
        ...values,
        type: 'add',
        newCostPrice: round2(unitCost),
        newSellingPrice: round2(selling)
      },
      {
        onSuccess: (result) => {
          onUpdated(result.product)
          form.reset({
            productId: result.product.id,
            type: 'add',
            quantity: 1,
            newCostPrice: result.product.costPrice,
            newSellingPrice: result.product.sellingPrice,
            reason: ''
          })
          setAmountText(String(round2(result.product.costPrice)))
          setUnitText(String(round2(result.product.costPrice)))
          setNoteOpen(false)
          setMode('total')
        }
      }
    )
  })

  const initials = product.name.slice(0, 2).toUpperCase()

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{product.name}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {product.barcode && <span className="font-mono">{product.barcode}</span>}
                <StockBadge qty={product.stockQty} unit={product.unit} threshold={product.minStock} />
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onChangeProduct}>
              {t('stock.changeProduct')}
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stock-qty">{t('stock.howMany')}</Label>
                <Controller
                  name="quantity"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <div className="relative">
                        <Input
                          id="stock-qty"
                          type="number"
                          min={1}
                          step={1}
                          className="pr-14 tabular-nums"
                          value={field.value}
                          onChange={(e) => field.onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                          {unit}
                        </span>
                      </div>
                      {fieldState.error && (
                        <p className="text-xs text-destructive">{t('stock.invalidQty')}</p>
                      )}
                    </>
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stock-amount">
                  {mode === 'total' ? t('stock.totalPaid') : t('stock.unitCost')}
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    {CURRENCY_SYMBOLS[currency]}
                  </span>
                  <Input
                    id="stock-amount"
                    type="number"
                    min={0}
                    step={0.01}
                    className="pl-7 tabular-nums"
                    value={mode === 'total' ? amountText : unitText}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (mode === 'total') setAmountText(raw)
                      else setUnitText(raw)
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground tabular-nums">
                {mode === 'total'
                  ? t('stock.derivedUnit', {
                      money: formatMoney(round2(unitCost), currency),
                      unit
                    })
                  : t('stock.derivedTotal', {
                      money: formatMoney(round2(amountPaid), currency),
                      qty,
                      unit
                    })}
              </p>
              <Button type="button" variant="ghost" size="xs" onClick={toggleMode}>
                {mode === 'total' ? t('stock.useUnit') : t('stock.useTotal')}
              </Button>
            </div>

            <Separator className="my-3" />

            {noteOpen ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stock-note">{t('stock.note')}</Label>
                <Textarea
                  id="stock-note"
                  rows={2}
                  autoFocus
                  placeholder={t('stock.notePlaceholder')}
                  {...form.register('reason')}
                />
              </div>
            ) : (
              <Button type="button" variant="ghost" size="xs" onClick={() => setNoteOpen(true)}>
                + {t('stock.addNote')}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t('stock.avgHint')}</p>
        </div>

        <CostAnswer
          product={product}
          preview={preview}
          selling={selling}
          onSellingChange={(price) => form.setValue('newSellingPrice', Math.max(0, price))}
        />
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
        <p className="text-sm text-muted-foreground tabular-nums">
          {qty} {unit} · {formatMoney(amountPaid, currency)}
        </p>
        <Button type="submit" disabled={qty < 1 || adjust.isPending}>
          {adjust.isPending ? t('stock.saving') : t('stock.save')}
        </Button>
      </div>
    </form>
  )
}
