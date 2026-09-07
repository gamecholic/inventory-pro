import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@shared/money'
import type { ProductRow } from '@shared/products'
import { StockBadge } from '@/components/stock-badge'
import { useProductSearch } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'
import { AdjustForm } from './AdjustForm'
import { PriceHistoryChart } from './PriceHistoryChart'

/** Features §5 — left search+cards, right adjustment form. */
export function StockPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data, isPending } = useProductSearch(search)
  const currency = settings?.general.currency ?? 'USD'

  const selected = (data ?? []).find((p) => p.id === selectedId) ?? null

  const select = (p: ProductRow): void => setSelectedId(p.id)
  const clear = (): void => setSelectedId(null)

  return (
    <div className="flex flex-col gap-4 px-4 lg:h-[calc(100svh-var(--header-height)-4rem)] lg:px-6">
      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-2 lg:h-full"> 
          <Input placeholder={t('stock.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {isPending ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (data ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('stock.noResults')}</p>
          ) : (
            <div data-testid="stock-list" className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:flex-1">
              {(data ?? []).map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                onClick={() => select(p)}
                className={`h-auto flex-col items-stretch gap-1 p-3 text-left font-normal ${
                  p.id === selectedId ? 'border-primary ring-1 ring-ring' : ''
                }`}
              >
                <span className="font-bold">{p.name}</span>
                {p.barcode && <span className="text-xs text-muted-foreground">{p.barcode}</span>}
                <span className="mt-1 text-sm">
                  <StockBadge qty={p.stockQty} unit={p.unit} threshold={p.minStock} />
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('stock.costIs')}: {formatMoney(p.costPrice, currency)}
                </span>
              </Button>
            ))}
          </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-4 lg:h-full lg:overflow-y-auto lg:pr-1">
          {selected ? (
            <>
              <AdjustForm key={selected.id} product={selected} onDone={clear} />
              <PriceHistoryChart productId={selected.id} />
            </>
          ) : (
            <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">
              {t('stock.selectPrompt')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
