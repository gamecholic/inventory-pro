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

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full max-w-full gap-1 overflow-x-auto overflow-y-hidden px-1.5 py-[3px] group-data-[orientation=horizontal]/tabs:h-[50px] sm:p-[3px] sm:group-data-[orientation=horizontal]/tabs:h-9 sm:w-fit">
            <TabsTrigger value="list" className="h-11 px-3 sm:h-[calc(100%-1px)] sm:px-4">
              {t('products.tabs.list')}
            </TabsTrigger>
            <TabsTrigger value="categories" className="h-11 px-3 sm:h-[calc(100%-1px)] sm:px-4">
              {t('products.tabs.categories')}
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="h-11 px-3 sm:h-[calc(100%-1px)] sm:px-4">
              {t('products.tabs.suppliers')}
            </TabsTrigger>
          </TabsList>
          <Button className="w-full sm:w-auto" onClick={() => addRef.current?.()}>{t(ADD_LABELS[tab as keyof typeof ADD_LABELS])}</Button>
        </div>
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
