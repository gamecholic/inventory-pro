import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ProductRow } from '@shared/products'
import { useCategories, useSuppliers } from '@/hooks/useCatalog'
import { CategoriesTab } from './CategoriesTab'
import { ProductFormDialog } from './ProductFormDialog'
import { ProductList } from './ProductList'
import { SuppliersTab } from './SuppliersTab'

/** Features §4 — three tabs. Add Product button only in list view. */
export function ProductsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState('list')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const { data: categories } = useCategories()
  const { data: suppliers } = useSuppliers()

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('products.title')}</h2>
        {tab === 'list' && (
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            {t('products.addProduct')}
          </Button>
        )}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <TabsList className="w-fit gap-1 px-1.5">
          <TabsTrigger value="list" className="px-4">
            {t('products.tabs.list')}
          </TabsTrigger>
          <TabsTrigger value="categories" className="px-4">
            {t('products.tabs.categories')}
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="px-4">
            {t('products.tabs.suppliers')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <ProductList
            onEdit={(p) => {
              setEditing(p)
              setDialogOpen(true)
            }}
          />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories ?? []}
        suppliers={suppliers ?? []}
        editing={editing}
      />
    </div>
  )
}
