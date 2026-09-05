import { Controller, useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatMoney, round2 } from '@shared/money'
import { computeAdjustment, stockAdjustInput, type StockAdjustInput } from '@shared/stock'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import { useAdjustStock } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

const num = (v: number): number => (Number.isNaN(v) ? 0 : v)

/** Features §5.2–§5.3 — adjustment form with live cost-averaging preview. Remounts per product. */
export function AdjustForm({
  product,
  onDone
}: {
  product: ProductRow
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
      quantity: 0,
      newCostPrice: product.costPrice,
      newSellingPrice: product.sellingPrice,
      reason: ''
    }
  })
  const type = form.watch('type')
  const quantity = form.watch('quantity') ?? 0
  const newCost = form.watch('newCostPrice') ?? product.costPrice

  const preview =
    type === 'add' && quantity > 0
      ? computeAdjustment(
          { stockQty: product.stockQty, costPrice: product.costPrice },
          { type, quantity, newCostPrice: newCost }
        )
      : null

  const onSubmit = form.handleSubmit((values) => {
    adjust.mutate(
      {
        ...values,
        newCostPrice: type === 'add' ? values.newCostPrice : null,
        newSellingPrice: values.newSellingPrice
      },
      { onSuccess: onDone }
    )
  })

  const resetForm = (): void => {
    form.reset({
      productId: product.id,
      type: 'add',
      quantity: 0,
      newCostPrice: product.costPrice,
      newSellingPrice: product.sellingPrice,
      reason: ''
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('stock.updateTitle', { name: product.name })}
        </CardTitle>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          <span>
            {t('stock.currentStock')}: {product.stockQty} {unitShort(product.unit, t)}
          </span>
          <span>
            {t('stock.currentCost')}: {formatMoney(product.costPrice, currency)}
          </span>
          <span>
            {t('stock.currentSelling')}: {formatMoney(product.sellingPrice, currency)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjType">{t('stock.type')}</Label>
              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="adjType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">{t('stock.add')}</SelectItem>
                      <SelectItem value="remove">{t('stock.remove')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjQty">{t('stock.quantity')} *</Label>
              <Controller
                name="quantity"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <Input
                      id="adjQty"
                      type="number"
                      min={0}
                      step={1}
                      value={field.value}
                      onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                    />
                    {fieldState.error && <p className="text-sm text-destructive">{t('stock.invalidQty')}</p>}
                  </>
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjCost">{t('stock.newCost')}</Label>
              <Controller
                name="newCostPrice"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="adjCost"
                    type="number"
                    min={0}
                    step={0.01}
                    disabled={type === 'remove'}
                    value={round2(field.value ?? product.costPrice)}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="adjSell">{t('stock.newSelling')}</Label>
              <Controller
                name="newSellingPrice"
                control={form.control}
                render={({ field }) => (
                  <Input
                    id="adjSell"
                    type="number"
                    min={0}
                    step={0.01}
                    value={round2(field.value ?? product.sellingPrice)}
                    onChange={(e) => field.onChange(num(e.target.valueAsNumber))}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adjReason">{t('stock.reason')}</Label>
            <Textarea id="adjReason" rows={2} {...form.register('reason')} />
          </div>
          {preview && (
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{t('stock.preview')}</p>
              <p className="text-muted-foreground">
                {preview.currentQty} {unitShort(product.unit, t)} + {quantity} {unitShort(product.unit, t)} →{' '}
                <strong className="text-foreground">
                  {preview.newQty} {unitShort(product.unit, t)}
                </strong>
              </p>
              <p className="text-muted-foreground">
                {formatMoney(preview.currentValue, currency)} → {formatMoney(preview.newValue, currency)}
              </p>
              <p>
                {t('stock.newAvg')}: <strong>{formatMoney(preview.newCost, currency)}</strong>
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={adjust.isPending}>
              {t('stock.update')}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              {t('stock.reset')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
