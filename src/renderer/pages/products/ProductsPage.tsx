import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoriesTab } from './CategoriesTab'
import { ProductList } from './ProductList'
import { SuppliersTab } from './SuppliersTab'

/** Features §4 — three tabs; each tab owns its toolbar, table and dialog. */
export function ProductsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState('list')

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">{t('products.title')}</h2>
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
          <ProductList />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
