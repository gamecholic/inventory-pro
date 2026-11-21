import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@shared/money'
import { normalizeTR } from '@shared/normalizeTR'
import { stockStatus, type ProductRow } from '@shared/products'
import { StockBadge } from '@/components/stock-badge'
import { useProductSearch } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'

type LevelFilter = 'all' | 'low' | 'out'

/**
 * Features §5.1 — the page's first state: one scan/search field over the whole
 * catalog. Picking a product replaces this view with the purchase form, so the
 * picker never competes with the form for space.
 */
export function ProductSearch({ onSelect }: { onSelect: (product: ProductRow) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LevelFilter>('all')
  const deferredSearch = useDeferredValue(search)
  const { data, isPending, isError, refetch } = useProductSearch(deferredSearch)
  const currency = settings?.general.currency ?? 'USD'

  const filtered = useMemo(() => {
    const rows = data ?? []
    if (filter === 'all') return rows
    return rows.filter((p) => stockStatus(p.stockQty, p.minStock) === filter)
  }, [data, filter])

  // Scanner fast-path: an exact barcode match selects without pressing Enter.
  useEffect(() => {
    const q = normalizeTR(deferredSearch.trim())
    if (q.length === 0) return
    const exact = (data ?? []).find((p) => normalizeTR(p.barcode ?? '') === q)
    if (exact) onSelect(exact)
  }, [data, deferredSearch, onSelect])

  const pickFirst = (): void => {
    if (search.trim().length > 0 && filtered.length > 0) onSelect(filtered[0])
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          aria-label={t('stock.findProduct')}
          placeholder={t('stock.findPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              pickFirst()
            }
          }}
          className="h-11 pr-10 pl-9"
        />
        {search.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setSearch('')}
            aria-label={t('stock.clearSearch')}
          >
            <X />
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['all', 'low', 'out'] as const).map((level) => (
            <Button
              key={level}
              type="button"
              variant={filter === level ? 'secondary' : 'outline'}
              size="xs"
              className="h-7"
              onClick={() => setFilter(level)}
            >
              {level === 'all' ? t('stock.all') : level === 'low' ? t('products.lowStock') : t('products.outOfStock')}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('products.loadFailed')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t('products.retry')}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t('stock.noResults')}</p>
      ) : (
        <div data-testid="stock-list" className="native-scroll flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {p.barcode && <span className="font-mono">{p.barcode}</span>}
                  <span className="tabular-nums">{formatMoney(p.costPrice, currency)}</span>
                </span>
              </span>
              <StockBadge qty={p.stockQty} unit={p.unit} threshold={p.minStock} />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">{t('stock.pickHint')}</p>
    </div>
  )
}
