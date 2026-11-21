import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ProductRow } from '@shared/products'
import { CorrectStockSheet } from './CorrectStockSheet'
import { ProductSearch } from './ProductSearch'
import { StockInView } from './StockInView'

/**
 * Features §5 — one page, one job: the owner bought more of something and needs
 * the new average cost. Two states only: find the product, then enter the
 * purchase. Corrections live behind a single header action.
 */
export function StockPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [correctOpen, setCorrectOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">{t('stock.subtitle')}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!product}
          onClick={() => setCorrectOpen(true)}
        >
          <SlidersHorizontal /> {t('stock.correctStock')}
        </Button>
      </div>

      {product ? (
        <StockInView
          key={product.id}
          product={product}
          onChangeProduct={() => setProduct(null)}
          onUpdated={setProduct}
        />
      ) : (
        <ProductSearch onSelect={setProduct} />
      )}

      {product && (
        <CorrectStockSheet
          product={product}
          open={correctOpen}
          onOpenChange={setCorrectOpen}
          onUpdated={setProduct}
        />
      )}
    </div>
  )
}
