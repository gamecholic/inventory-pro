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
  const q = search.trim()
  const nq = normalizeTR(q)
  return catalog.filter((p) => {
    if (categoryId !== null && p.categoryId !== categoryId) return false
    if (q === '') return true
    if (normalizeTR(p.name).includes(nq)) return true
    if ((p.barcode ?? '').toLowerCase().includes(q.toLowerCase())) return true
    if (String(p.sellingPrice).includes(q)) return true
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
    <div className="flex flex-col gap-3">
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
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t('pos.categories')} {expanded ? '▾' : '▸'}
        </button>
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
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const out = p.stockQty <= 0
            return (
              <button
                key={p.id}
                type="button"
                disabled={out}
                onClick={() => onPick(p)}
                className={`flex flex-col gap-1 rounded-lg border border-border p-3 text-left transition-colors ${
                  out ? 'opacity-50' : 'hover:bg-muted/50'
                }`}
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-sm">{formatMoney(p.sellingPrice, currency)}</span>
                <span className={`text-xs ${out ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {out
                    ? t('pos.outOfStock')
                    : `${t('pos.inStock')}: ${p.stockQty} ${unitShort(p.unit, t)}`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
