import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@shared/money'
import { normalizeTR } from '@shared/normalizeTR'
import { stockStatus, type ProductRow } from '@shared/products'
import { unitShort } from '@shared/units'
import { StockBadge } from '@/components/stock-badge'
import { useProductSearch } from '@/hooks/useStock'
import { useSettings } from '@/hooks/useSettings'
import { ReceiveDialog } from './ReceiveDialog'
import { PriceHistoryChart } from './PriceHistoryChart'

type LevelFilter = 'all' | 'low' | 'out'

/** Features §5 — left search+cards, right product summary + chart, form in a dialog. */
export function StockPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<LevelFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data, isPending, isError, refetch } = useProductSearch(search)
  const currency = settings?.general.currency ?? 'USD'

  const filtered = useMemo(() => {
    const rows = data ?? []
    if (filter === 'all') return rows
    return rows.filter((p) => stockStatus(p.stockQty, p.minStock) === filter)
  }, [data, filter])

  const selected = (data ?? []).find((p) => p.id === selectedId) ?? null

  // Scanner fast-path: exact barcode match auto-selects.
  useEffect(() => {
    const q = normalizeTR(search.trim())
    if (q.length === 0 || (data ?? []).length === 0) return
    const exact = (data ?? []).find((p) => normalizeTR(p.barcode ?? '') === q)
    if (exact && exact.id !== selectedId) setSelectedId(exact.id)
  }, [data, search, selectedId])

  const select = (p: ProductRow): void => setSelectedId(p.id)

  const handleDone = (): void => {
    // Keep the selection so the updated summary + price history stay visible.
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-4 px-4 lg:h-[calc(100svh-var(--header-height)-4rem-(var(--spacing)*2))] lg:px-6">
      <div className="grid min-h-0 flex-1 items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-2 lg:h-full">
          <div className="relative">
            <Input
              placeholder={t('stock.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
            {search.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
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
                  onClick={() => setFilter(level)}
                >
                  {level === 'all'
                    ? t('stock.all')
                    : level === 'low'
                      ? t('products.lowStock')
                      : t('products.outOfStock')}
                </Button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
          </div>
          {isPending ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : isError ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">{t('products.loadFailed')}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                {t('products.retry')}
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t('stock.noResults')}</p>
          ) : (
            <ScrollArea data-testid="stock-list" className="min-h-0 lg:flex-1">
              <div className="flex flex-col gap-2 pr-3">
                {filtered.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  onClick={() => select(p)}
                  aria-pressed={p.id === selectedId}
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
            </ScrollArea>
          )}
        </div>
        <ScrollArea className="min-h-0 lg:h-full">
          <div className="flex flex-col gap-4 pr-3">
            {selected ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{t('stock.receiveBadge')}</Badge>
                      <CardTitle>{selected.name}</CardTitle>
                    </div>
                    {selected.barcode && (
                      <p className="text-xs text-muted-foreground">{selected.barcode}</p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="text-sm">
                      <StockBadge
                        qty={selected.stockQty}
                        unit={selected.unit}
                        threshold={selected.minStock}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {t('stock.currentCost')}: {formatMoney(selected.costPrice, currency)} ·{' '}
                      {t('stock.currentSelling')}: {formatMoney(selected.sellingPrice, currency)} ·{' '}
                      {t('stock.inventoryValue')}: {formatMoney(selected.stockQty * selected.costPrice, currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {unitShort(selected.unit, t)} · {t('stock.receiveHint')}
                    </p>
                    <div>
                      <Button type="button" onClick={() => setDialogOpen(true)}>
                        <Plus /> {t('stock.receive')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <PriceHistoryChart productId={selected.id} />
              </>
            ) : (
              <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">
                {t('stock.selectPrompt')}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
      {selected && (
        <ReceiveDialog
          key={selected.id}
          product={selected}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDone={handleDone}
        />
      )}
    </div>
  )
}
