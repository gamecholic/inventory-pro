import { useState } from 'react'
import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { formatMoney } from '@shared/money'
import type { ProductListFilter, ProductRow } from '@shared/products'
import { useArchiveProduct, useCategories, useProducts, useRestoreProduct } from '@/hooks/useCatalog'
import { useSettings } from '@/hooks/useSettings'
import { StockBadge } from './StockBadge'

const STOCK_LEVELS = ['all', 'out', 'low', 'in'] as const
const STATUSES = ['active', 'deleted', 'all'] as const

/** Features §4.2–§4.3 — search, filters, paginated table, archive/restore. */
export function ProductList({
  onEdit
}: {
  onEdit: (product: ProductRow) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { data: settings } = useSettings()
  const { data: categories } = useCategories()
  const archive = useArchiveProduct()
  const restore = useRestoreProduct()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [restoreId, setRestoreId] = useState<number | null>(null)
  const [filter, setFilter] = useState<ProductListFilter>({
    search: '',
    categoryId: null,
    stockLevel: 'all',
    status: 'active',
    page: 1
  })

  const { data, isPending, isError, refetch } = useProducts(filter)
  const patch = (p: Partial<ProductListFilter>): void =>
    setFilter((f) => ({ ...f, ...p, page: p.page ?? 1 }))

  const searching = filter.search.trim() !== '' || filter.categoryId !== null || filter.stockLevel !== 'all'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder={t('products.search')}
          value={filter.search}
          onChange={(e) => patch({ search: e.target.value })}
        />
        <Select
          value={filter.categoryId === null ? 'all' : String(filter.categoryId)}
          onValueChange={(v) => patch({ categoryId: v === 'all' ? null : Number(v) })}
        >
          <SelectTrigger id="fCategory" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.allCategories')}</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.stockLevel} onValueChange={(v) => patch({ stockLevel: v as ProductListFilter['stockLevel'] })}>
          <SelectTrigger id="fStock" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('products.allLevels')}</SelectItem>
            {STOCK_LEVELS.filter((l) => l !== 'all').map((l) => (
              <SelectItem key={l} value={l}>
                {t(`products.${l === 'out' ? 'outOfStock' : l === 'low' ? 'lowStock' : 'inStock'}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filter.status} onValueChange={(v) => patch({ status: v as ProductListFilter['status'] })}>
          <SelectTrigger id="fStatus" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`products.${s === 'active' ? 'activeProducts' : s === 'deleted' ? 'deletedProducts' : 'allProducts'}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-4 rounded-lg border border-border p-6">
          <p>{t('products.loadFailed')}</p>
          <Button variant="outline" onClick={() => void refetch()}>
            {t('products.retry')}
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <p className="font-medium">{searching ? t('products.noResults') : t('products.noProducts')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {searching ? t('products.noResultsHint') : t('products.noProductsHint')}
          </p>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('products.colName')}</TableHead>
                <TableHead>{t('products.colCategory')}</TableHead>
                <TableHead>{t('products.colPrice')}</TableHead>
                <TableHead>{t('products.colStock')}</TableHead>
                <TableHead className="text-right">{t('products.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.archivedAt ? (
                      <span className="text-muted-foreground">
                        <s>{p.name}</s> ({t('products.deletedLabel')})
                      </span>
                    ) : (
                      p.name
                    )}
                  </TableCell>
                  <TableCell>{p.categoryName ?? '—'}</TableCell>
                  <TableCell>{formatMoney(p.sellingPrice, settings?.general.currency ?? 'USD')}</TableCell>
                  <TableCell>
                    <StockBadge qty={p.stockQty} unit={p.unit} threshold={p.minStock} />
                  </TableCell>
                  <TableCell className="text-right">
                    {p.archivedAt ? (
                      <Button variant="ghost" size="icon" title={t('products.restoreTitle')} onClick={() => setRestoreId(p.id)}>
                        <RotateCcw className="size-4" />
                      </Button>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" title={t('products.editProduct')} onClick={() => onEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t('products.archiveTitle')} onClick={() => setConfirmId(p.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t('products.pageOf', { page: data.page, pages: data.totalPages })} ·{' '}
              {t('products.totalItems', { count: data.total })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setFilter((f) => ({ ...f, page: f.page - 1 }))}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setFilter((f) => ({ ...f, page: f.page + 1 }))}
              >
                →
              </Button>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.archiveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('products.archiveDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('products.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId !== null) archive.mutate(confirmId)
                setConfirmId(null)
              }}
            >
              {t('settings.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreId !== null} onOpenChange={(o) => !o && setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('products.restoreDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('products.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restoreId !== null) restore.mutate(restoreId)
                setRestoreId(null)
              }}
            >
              {t('settings.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
