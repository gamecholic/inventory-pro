import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney, round2 } from '@shared/money'
import { computeAdjustment, stockAdjustInput, type StockAdjustInput } from '@shared/stock'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import { useAdjustStock } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

const num = (v: number): number => (Number.isNaN(v) ? 0 : v)

const marginPct = (selling: number, cost: number): number | null => {
  if (!Number.isFinite(selling) || selling <= 0) return null
  return ((selling - cost) / selling) * 100
}

const fmtPct = (v: number | null): string => (v === null ? '—' : `${v.toFixed(1)}%`)

/** Features §5.2–§5.3 — receive dialog with inputs + live preview. Mounts fresh per open. */
export function ReceiveDialog({
  product,
  open,
  onOpenChange,
  onDone
}: {
  product: ProductRow
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const adjust = useAdjustStock()
  const currency = settings?.general.currency ?? 'USD'

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
  const type = form.watch('type')
  const quantity = form.watch('quantity') ?? 0
  const newCost = form.watch('newCostPrice') ?? product.costPrice
  const newSelling = form.watch('newSellingPrice') ?? product.sellingPrice
  const reason = form.watch('reason') ?? ''
  const isAdd = type === 'add'

  // Lot total <-> unit cost two-way sync. Total is a helper, not submitted.
  // totalText holds the in-progress typing; null means follow qty * unit.
  const [totalText, setTotalText] = useState<string | null>(null)
  const derivedTotal = round2(num(quantity) * num(newCost))
  const displayTotal = totalText ?? String(derivedTotal)
  useEffect(() => {
    setTotalText(null)
  }, [product.id])

  const preview =
    quantity > 0
      ? computeAdjustment(
          { stockQty: product.stockQty, costPrice: product.costPrice },
          { type, quantity, newCostPrice: isAdd ? newCost : null }
        )
      : null

  const oldMargin = marginPct(product.sellingPrice, product.costPrice)
  const newAvgCost = preview ? preview.newCost : product.costPrice
  const effectiveSelling = num(newSelling)
  const newMargin = marginPct(effectiveSelling, newAvgCost)
  const isLoss = effectiveSelling > 0 && newAvgCost > effectiveSelling
  const marginDropped =
    oldMargin !== null && newMargin !== null && oldMargin - newMargin >= 5 && !isLoss

  const keepMargin = (): void => {
    if (oldMargin === null || oldMargin >= 100) return
    const target = round2(newAvgCost / (1 - oldMargin / 100))
    if (Number.isFinite(target) && target >= 0) form.setValue('newSellingPrice', target)
  }

  const applyTotal = (raw: string): void => {
    setTotalText(raw)
    const total = Number(raw)
    if (!Number.isFinite(total) || total < 0) return
    if (!Number.isFinite(num(quantity)) || num(quantity) <= 0) return
    form.setValue('newCostPrice', round2(total / num(quantity)))
  }

  const onSubmit = form.handleSubmit((values) => {
    adjust.mutate(
      {
        ...values,
        newCostPrice: isAdd ? values.newCostPrice : null,
        newSellingPrice: values.newSellingPrice
      },
      { onSuccess: onDone }
    )
  })

  const resetForm = (): void => {
    form.reset({
      productId: product.id,
      type: 'add',
      quantity: 1,
      newCostPrice: product.costPrice,
      newSellingPrice: product.sellingPrice,
      reason: ''
    })
    setTotalText(null)
  }

  const lotValue = isAdd ? round2(num(quantity) * num(newCost)) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-4rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant={isAdd ? 'default' : 'destructive'}>
              {isAdd ? t('stock.receiveBadge') : t('stock.correctionBadge')}
            </Badge>
            <DialogTitle>
              {isAdd
                ? t('stock.updateTitle', { name: product.name })
                : t('stock.correctionTitle', { name: product.name })}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isAdd ? t('stock.receiveHint') : t('stock.correctionHint')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('stock.type')}</Label>
            <Tabs
              value={type}
              onValueChange={(v) => form.setValue('type', v as 'add' | 'remove')}
            >
              <TabsList>
                <TabsTrigger value="add">
                  <Plus /> {t('stock.add')}
                </TabsTrigger>
                <TabsTrigger value="remove">
                  <Minus /> {t('stock.remove')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjQty">{isAdd ? t('stock.quantity') : t('stock.quantityRemove')} *</Label>
              <Controller
                name="quantity"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="adjQty"
                      type="number"
                      min={1}
                      step={1}
                      className="tabular-nums"
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(Math.max(0, Math.round(num(e.target.valueAsNumber))))
                        setTotalText(null)
                      }}
                    />
                    {fieldState.error && <p className="text-sm text-destructive">{t('stock.invalidQty')}</p>}
                  </>
                )}
              />
            </div>
            {isAdd ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjTotal">{t('stock.lotTotal')}</Label>
              <Input
                id="adjTotal"
                type="number"
                min={0}
                step={0.01}
                className="tabular-nums"
                value={displayTotal}
                onChange={(e) => applyTotal(e.target.value)}
                onBlur={() => setTotalText(null)}
              />
              <p className="text-xs text-muted-foreground">{t('stock.lotTotalHint')}</p>
            </div>
            ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjSell">{t('stock.newSelling')}</Label>
              <Controller
                name="newSellingPrice"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="adjSell"
                      type="number"
                      min={0}
                      step={0.01}
                      className="tabular-nums"
                      value={round2(field.value ?? product.sellingPrice)}
                      onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                    />
                    {fieldState.error && (
                      <p className="text-sm text-destructive">{t('products.actionFailed')}</p>
                    )}
                  </>
                )}
              />
              <p className="text-xs text-muted-foreground">{t('stock.sellingHint')}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {fmtPct(oldMargin)} → {fmtPct(newMargin)}
                </span>
                <Button type="button" variant="ghost" size="xs" onClick={keepMargin}>
                  {t('stock.keepMargin')}
                </Button>
              </div>
            </div>
            )}
          </div>
          {isAdd && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adjCost">{t('stock.newCost')}</Label>
                <Controller
                  name="newCostPrice"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="adjCost"
                        type="number"
                        min={0}
                        step={0.01}
                        className="tabular-nums"
                        value={round2(field.value ?? product.costPrice)}
                        onChange={(e) => {
                          field.onChange(num(e.target.valueAsNumber))
                          setTotalText(null)
                        }}
                      />
                      {fieldState.error && (
                        <p className="text-sm text-destructive">{t('products.actionFailed')}</p>
                      )}
                    </>
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adjSell">{t('stock.newSelling')}</Label>
                <Controller
                  name="newSellingPrice"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="adjSell"
                        type="number"
                        min={0}
                        step={0.01}
                        className="tabular-nums"
                        value={round2(field.value ?? product.sellingPrice)}
                        onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                      />
                      {fieldState.error && (
                        <p className="text-sm text-destructive">{t('products.actionFailed')}</p>
                      )}
                    </>
                  )}
                />
                <p className="text-xs text-muted-foreground">{t('stock.sellingHint')}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {fmtPct(oldMargin)} → {fmtPct(newMargin)}
                  </span>
                  <Button type="button" variant="ghost" size="xs" onClick={keepMargin}>
                    {t('stock.keepMargin')}
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="adjReason">{t('stock.reason')}</Label>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['purchase', t('stock.reasonPurchase')],
                  ['return', t('stock.reasonReturn')],
                  ['recount', t('stock.reasonRecount')]
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  variant={reason === label ? 'secondary' : 'outline'}
                  size="xs"
                  onClick={() => form.setValue('reason', reason === label ? '' : label)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Textarea
              id="adjReason"
              rows={2}
              placeholder={t('stock.reasonPlaceholder')}
              {...form.register('reason')}
            />
          </div>
          </div>
          <div className="flex flex-col gap-4">
          {isLoss && preview && (
            <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {t('stock.lossWarning')}
            </p>
          )}
          {!isLoss && marginDropped && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t('stock.marginDrop', {
                old: fmtPct(oldMargin).replace('%', ''),
                new: fmtPct(newMargin).replace('%', '')
              })}
            </p>
          )}
          {preview && isAdd && (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{t('stock.preview')}</p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground">{t('stock.previewLot')}</span>
                <span className="text-right tabular-nums">
                  +{quantity} {unitShort(product.unit, t)} · {formatMoney(lotValue, currency)}
                </span>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between gap-2">
                <span>{t('stock.newAvg')}</span>
                <span className="text-right tabular-nums">
                  {formatMoney(product.costPrice, currency)} →{' '}
                  <strong>{formatMoney(preview.newCost, currency)}</strong>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span>{t('stock.newTotal')}</span>
                <span className="text-right tabular-nums">
                  {preview.currentQty} {unitShort(product.unit, t)} →{' '}
                  <strong>
                    {preview.newQty} {unitShort(product.unit, t)}
                  </strong>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span>{t('stock.newValue')}</span>
                <span className="text-right tabular-nums">
                  {formatMoney(preview.currentValue, currency)} →{' '}
                  <strong>{formatMoney(preview.newValue, currency)}</strong>
                </span>
              </div>
            </div>
          )}
          {preview && !isAdd && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{t('stock.removePreview')}</p>
              <p className="text-muted-foreground tabular-nums">
                {preview.currentQty} {unitShort(product.unit, t)} − {quantity}{' '}
                {unitShort(product.unit, t)} →{' '}
                <strong className="text-foreground">
                  {preview.newQty} {unitShort(product.unit, t)}
                </strong>
              </p>
              <p className="text-muted-foreground tabular-nums">
                {formatMoney(preview.currentValue, currency)} → {formatMoney(preview.newValue, currency)}
              </p>
            </div>
          )}
          </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('pos.cancel')}
              </Button>
            </DialogClose>
            <Button type="button" variant="outline" onClick={resetForm}>
              <RotateCcw /> {t('stock.reset')}
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending
                ? t('stock.saving')
                : isAdd
                  ? t('stock.receive')
                  : t('stock.removeConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
