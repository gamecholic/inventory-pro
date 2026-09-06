import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
    <div className="px-4 lg:px-6">
      <h2 className="mb-4 text-2xl font-semibold">{t('stock.title')}</h2>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Input placeholder={t('stock.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {isPending ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (data ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('stock.noResults')}</p>
          ) : (
            (data ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  p.id === selectedId ? 'border-primary ring-1 ring-ring' : 'border-border hover:bg-muted/50'
                }`}
              >
                <p className="font-bold">{p.name}</p>
                {p.barcode && <p className="text-xs text-muted-foreground">{p.barcode}</p>}
                <p className="mt-1 text-sm">
                  <StockBadge qty={p.stockQty} unit={p.unit} threshold={p.minStock} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('stock.costIs')}: {formatMoney(p.costPrice, currency)}
                </p>
              </button>
            ))
          )}
        </div>
        <div className="flex flex-col gap-4">
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
