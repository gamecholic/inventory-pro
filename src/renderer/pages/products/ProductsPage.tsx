import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoriesTab } from './CategoriesTab'
import { ProductList } from './ProductList'
import { SuppliersTab } from './SuppliersTab'

const ADD_LABELS = { list: 'products.addProduct', categories: 'products.addCategory', suppliers: 'products.addSupplier' } as const

/** Features §4 — three tabs sharing one header Add button; each tab owns its dialog. */
export function ProductsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [tab, setTab] = useState('list')
  const addRef = useRef<(() => void) | null>(null)
  const registerAdd = useCallback((open: () => void) => {
    addRef.current = open
  }, [])

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t('products.title')}</h2>
        <Button onClick={() => addRef.current?.()}>{t(ADD_LABELS[tab as keyof typeof ADD_LABELS])}</Button>
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
          <ProductList registerAdd={registerAdd} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab registerAdd={registerAdd} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab registerAdd={registerAdd} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
