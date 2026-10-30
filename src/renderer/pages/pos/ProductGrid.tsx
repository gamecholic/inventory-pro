import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown } from 'lucide-react'
import { normalizeTR } from '@shared/normalizeTR'
import { formatMoney, type StoreCurrency } from '@shared/money'
import { unitShort } from '@shared/units'
import type { ProductRow } from '@shared/products'
import type { CategoryRow } from '@shared/products'
import { useSettings } from '@/hooks/useSettings'

/** Shared by live grid filtering and submit auto-add (§3.1, §3.3). */
export function filterPosProducts(catalog: ProductRow[], search: string, categoryId: number | null): ProductRow[] {
  const query = search.trim()
  const normalizedQuery = normalizeTR(query)
  return catalog.filter((p) => {
    if (categoryId !== null && p.categoryId !== categoryId) return false
    if (query === '') return true
    if (normalizeTR(p.name).includes(normalizedQuery)) return true
    if (normalizeTR(p.barcode ?? '').includes(normalizedQuery)) return true
    if (String(p.sellingPrice).includes(query)) return true
    return false
  })
}

const ROW_ESTIMATE = 68
const THREE_COLUMN_BREAKPOINT = 1280

/** Mirror the old `grid-cols-2 xl:grid-cols-3` breakpoints so virtualization doesn't change the layout. */
function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return width
}

/** One card. Memoized so scrolling/filtering only reconciles the cards currently mounted. */
const ProductCard = memo(function ProductCard({
  product,
  currency,
  onPick
}: {
  product: ProductRow
  currency: StoreCurrency
  onPick: (product: ProductRow) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const out = product.stockQty <= 0

  return (
    <Button
      type="button"
      variant="outline"
      disabled={out}
      onClick={() => onPick(product)}
      className={`h-auto flex-col items-stretch gap-0.5 p-2 text-left font-normal ${out ? 'opacity-50' : ''}`}
    >
      <span className="truncate text-sm font-medium">{product.name}</span>
      <span className="flex items-baseline justify-between gap-1">
        <span className="text-sm font-semibold">{formatMoney(product.sellingPrice, currency)}</span>
        <span className={`truncate text-[11px] ${out ? 'text-destructive' : 'text-muted-foreground'}`}>
          {out ? t('pos.outOfStock') : `${product.stockQty} ${unitShort(product.unit, t)}`}
        </span>
      </span>
    </Button>
  )
})

export function ProductGrid({
  catalog,
  categories,
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  onPick,
  searchRef
}: {
  catalog: ProductRow[]
  categories: CategoryRow[]
  search: string
  onSearchChange: (v: string) => void
  categoryId: number | null
  onCategoryChange: (v: number | null) => void
  onPick: (product: ProductRow) => void
  searchRef: RefObject<HTMLInputElement | null>
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const currency = settings?.general.currency ?? 'USD'
  const filtered = useMemo(() => filterPosProducts(catalog, search, categoryId), [catalog, search, categoryId])

  // The virtualizer needs the actual scrolling element. shadcn's ScrollArea
  // renders a Radix root + viewport, so query its viewport instead of using a
  // plain overflow div and losing the themed scrollbar.
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const getScrollElement = useCallback((): HTMLElement | null => {
    const root = scrollRootRef.current
    return root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null
  }, [])

  const viewportWidth = useViewportWidth()
  const columns = viewportWidth >= THREE_COLUMN_BREAKPOINT ? 3 : 2
  const rows = useMemo(() => {
    const chunked: ProductRow[][] = []
    for (let i = 0; i < filtered.length; i += columns) chunked.push(filtered.slice(i, i + columns))
    return chunked
  }, [filtered, columns])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 4
  })

  // Filter changes should always start at the top of the results.
  useEffect(() => {
    getScrollElement()?.scrollTo({ top: 0 })
  }, [search, categoryId, getScrollElement])

  // Column changes rebuild rows, so stale row measurements must be dropped.
  useEffect(() => {
    virtualizer.measure()
  }, [columns, virtualizer])

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      <div className="flex gap-2">
        <Input
          ref={searchRef}
          placeholder={t('pos.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <Button type="submit">{t('pos.search')}</Button>
      </div>
      <Collapsible className="border-border relative gap-2 rounded-lg border px-2 py-1">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="w-full group px-1 flex items-center justify-between text-muted-foreground hover:text-foreground">
            {t('pos.categories')}
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="mt-2 h-32 max-h-32">
            <div className="flex flex-wrap gap-2 pr-3">
              <Button
                size="sm"
                variant={categoryId === null ? 'default' : 'outline'}
                onClick={() => onCategoryChange(null)}
              >
                {t('pos.all')}
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={categoryId === c.id ? 'default' : 'outline'}
                  onClick={() => onCategoryChange(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
      {catalog.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('pos.noProducts')}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('pos.noResults')}</p>
      ) : (
        <ScrollArea
          ref={scrollRootRef}
          data-testid="product-grid"
          className="min-h-0 h-[65vh] pr-3 lg:h-auto lg:flex-1"
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: '0.5rem',
                    paddingBottom: '0.5rem'
                  }}
                >
                  {row.map((p) => (
                    <ProductCard key={p.id} product={p} currency={currency} onPick={onPick} />
                  ))}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
