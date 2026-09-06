import { useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeTR } from '@shared/normalizeTR'
import { formatMoney } from '@shared/money'
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
  const [expanded, setExpanded] = useState(false)
  const currency = settings?.general.currency ?? 'USD'
  const filtered = filterPosProducts(catalog, search, categoryId)

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
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-1 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((e) => !e)}
        >
          {t('pos.categories')} {expanded ? '▾' : '▸'}
        </Button>
        {expanded && (
          <div className="mt-2 flex flex-wrap gap-2">
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
        )}
      </div>
      {catalog.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('pos.noProducts')}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-border p-8 text-center text-muted-foreground">{t('pos.noResults')}</p>
      ) : (
        <div data-testid="product-grid" className="grid min-h-0 grid-cols-2 content-start gap-2 overflow-y-auto pr-1 lg:flex-1 xl:grid-cols-3">
          {filtered.map((p) => {
            const out = p.stockQty <= 0
            return (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                disabled={out}
                onClick={() => onPick(p)}
                className={`h-auto flex-col items-stretch gap-0.5 p-2 text-left font-normal ${
                  out ? 'opacity-50' : ''
                }`}
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-semibold">{formatMoney(p.sellingPrice, currency)}</span>
                  <span className={`truncate text-[11px] ${out ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {out ? t('pos.outOfStock') : `${p.stockQty} ${unitShort(p.unit, t)}`}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
